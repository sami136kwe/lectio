import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BOOK_BY_CODE, BOOKS } from "@/lib/bible/books";
import { cardsByIds } from "@/lib/cards";
import { messagesFor } from "@/lib/i18n/server";
import { getViewer, requireOnboardedUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { ReadInOrder } from "./ReadInOrder";

type Params = { params: Promise<{ code: string }>; searchParams: Promise<{ after?: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const book = BOOK_BY_CODE.get((await params).code.toUpperCase());
  const { locale } = await getViewer();
  return book ? { title: `${locale === "fr" ? book.name_fr : book.name_en} · ${messagesFor(locale).books.readInOrder}` } : {};
}

/** Continuous reading of one book, card after card in the order of the text, resuming where the reader stopped. */
export default async function ReadBookPage({ params, searchParams }: Params) {
  const book = BOOK_BY_CODE.get((await params).code.toUpperCase());
  if (!book) notFound();
  const { user, locale } = await requireOnboardedUser(`/books/${book.code}/read`);
  const t = messagesFor(locale);
  const supabase = await createClient();

  const { data: rows } = await supabase.from("card_details").select("id, sort_key").eq("book_code", book.code).eq("status", "published").eq("language", locale).order("sort_key");
  const list = rows ?? [];
  const afterParam = Number((await searchParams).after);
  let after = 0;
  if (Number.isFinite(afterParam) && (await searchParams).after !== undefined) after = afterParam;
  else {
    const { data: progress } = await supabase.from("reading_progress").select("last_sort_key").eq("user_id", user.id).eq("book_code", book.code).maybeSingle();
    after = progress?.last_sort_key ?? 0;
  }
  const index = list.findIndex((r) => r.sort_key! > after);
  const name = locale === "fr" ? book.name_fr : book.name_en;
  const nextBook = BOOKS[BOOKS.findIndex((b) => b.code === book.code) + 1];

  if (index < 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <h1 className="font-serif text-3xl font-bold">{name}</h1>
        <p className="text-lg">{list.length ? t.books.endOfBook : t.books.noCards}</p>
        <div className="flex flex-wrap gap-2">
          {list.length > 0 && (
            <Link href={`/books/${book.code}/read?after=0`} className="btn-ghost">
              {t.books.restart}
            </Link>
          )}
          {nextBook && (
            <Link href={`/books/${nextBook.code}/read`} className="btn-primary">
              {t.books.nextBook(locale === "fr" ? nextBook.name_fr : nextBook.name_en)}
            </Link>
          )}
        </div>
      </div>
    );
  }

  const [card] = await cardsByIds(supabase, [list[index]!.id!], locale);
  const previousAfter = index >= 2 ? list[index - 2]!.sort_key! : 0;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between gap-2 text-sm text-muted">
        <Link href={`/books/${book.code}`} className="hover:text-ink">
          ← {name}
        </Link>
        <span data-testid="reading-position">{t.books.position(index + 1, list.length)}</span>
      </div>
      {card && <ReadInOrder card={card} bookCode={book.code} previousHref={index > 0 ? `/books/${book.code}/read?after=${previousAfter}` : null} />}
    </div>
  );
}
