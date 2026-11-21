import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CardGrid } from "@/components/CardGrid";
import { BOOK_BY_CODE } from "@/lib/bible/books";
import { BOOK_SUMMARIES } from "@/lib/bible/summaries";
import { cardsByIds } from "@/lib/cards";
import { messagesFor } from "@/lib/i18n/server";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ code: string }>; searchParams: Promise<{ chapter?: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const book = BOOK_BY_CODE.get((await params).code.toUpperCase());
  if (!book) return {};
  const { locale } = await getViewer();
  return { title: locale === "fr" ? book.name_fr : book.name_en };
}

export default async function BookPage({ params, searchParams }: Params) {
  const book = BOOK_BY_CODE.get((await params).code.toUpperCase());
  if (!book) notFound();
  const { locale, user } = await getViewer();
  const t = messagesFor(locale);
  const supabase = await createClient();
  const chapterParam = Number((await searchParams).chapter);
  const chapter = Number.isInteger(chapterParam) && chapterParam >= 1 && chapterParam <= (book.code === "PSA" ? 151 : book.chapters) ? chapterParam : null;

  let query = supabase.from("card_details").select("id, chapter_start").eq("book_code", book.code).eq("status", "published").eq("language", locale).order("sort_key");
  if (chapter) query = query.eq("chapter_start", chapter);
  const { data: rows } = await query.limit(60);
  const { data: all } = await supabase.from("card_details").select("id, chapter_start").eq("book_code", book.code).eq("status", "published").eq("language", locale);
  const perChapter = new Map<number, number>();
  for (const r of all ?? []) perChapter.set(r.chapter_start!, (perChapter.get(r.chapter_start!) ?? 0) + 1);
  const cards = await cardsByIds(supabase, (rows ?? []).map((r) => r.id!), locale);

  let read = 0;
  if (user) {
    const { data } = await supabase.rpc("book_progress", { p_language: locale });
    read = Number(data?.find((r) => r.book_code === book.code)?.read ?? 0);
  }
  const name = locale === "fr" ? book.name_fr : book.name_en;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/books" className="text-sm text-muted hover:text-ink">
          ← {t.books.title}
        </Link>
        <h1 className="font-serif text-3xl font-bold">{name}</h1>
        <p className="max-w-2xl text-muted">{BOOK_SUMMARIES[book.code]?.[locale]}</p>
        {book.code === "PSA" && <p className="text-sm text-muted">{t.books.psalmNumbering}</p>}
        <div className="flex flex-wrap items-center gap-3">
          {(all ?? []).length > 0 && (
            <Link href={`/books/${book.code}/read`} className="btn-primary" data-testid="read-in-order">
              {read > 0 ? t.books.continueReading : t.books.readInOrder}
            </Link>
          )}
          {user && (all ?? []).length > 0 && <span className="text-sm text-muted">{t.books.progress(read, (all ?? []).length)}</span>}
        </div>
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{t.books.allChapters}</h2>
        <nav aria-label={t.books.chaptersNav} className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-10">
          {Array.from({ length: book.code === "PSA" ? 150 : book.chapters }, (_, i) => i + 1).map((c) => {
            const n = perChapter.get(c) ?? 0;
            return (
              <Link
                key={c}
                href={`/books/${book.code}/${c}`}
                className={`card-surface relative flex h-12 items-center justify-center font-semibold hover:bg-surface-2 ${n ? "text-accent" : ""}`}
                title={n ? t.books.chapterHasCards(n) : t.books.readChapter}
                data-testid={`chapter-${c}`}
              >
                {c}
                {n > 0 && <span aria-hidden="true" className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />}
              </Link>
            );
          })}
        </nav>
      </section>
      {cards.length > 0 && <h2 className="text-xl font-semibold">{t.books.commented}</h2>}
      {cards.length > 0 ? <CardGrid cards={cards} /> : <p className="text-muted">{t.books.noCards}</p>}
    </div>
  );
}
