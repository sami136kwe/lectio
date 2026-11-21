import type { Metadata } from "next";
import Link from "next/link";
import { BOOK_GROUPS, BOOKS } from "@/lib/bible/books";
import { messagesFor } from "@/lib/i18n/server";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: messagesFor((await getViewer()).locale).books.title };
}

export default async function BooksPage() {
  const { locale, user } = await getViewer();
  const t = messagesFor(locale);
  const supabase = await createClient();
  const { data } = await supabase.rpc("book_progress", { p_language: locale });
  const progress = new Map((data ?? []).map((r) => [r.book_code, r]));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-3xl font-bold">{t.books.title}</h1>
        <p className="text-muted">{t.books.subtitle}</p>
      </div>
      {BOOK_GROUPS.map((group) => (
        <section key={group} className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">{t.books.groups[group]}</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {BOOKS.filter((b) => b.group === group).map((b) => {
              const p = progress.get(b.code);
              const total = Number(p?.total ?? 0);
              const read = Number(p?.read ?? 0);
              return (
                <li key={b.code}>
                  <Link href={`/books/${b.code}`} className="card-surface flex items-center justify-between gap-3 p-4 hover:bg-surface-2" data-testid={`book-${b.code}`}>
                    <span className="flex flex-col">
                      <span className="font-semibold">{locale === "fr" ? b.name_fr : b.name_en}</span>
                      <span className="text-xs text-muted">{t.books.chapters(b.chapters)}</span>
                    </span>
                    {total > 0 && (
                      <span className="shrink-0 text-xs text-muted">{user ? t.books.progress(read, total) : t.category.cards(total)}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
