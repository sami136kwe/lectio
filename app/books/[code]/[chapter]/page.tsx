import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LogionCard } from "@/components/LogionCard";
import { BOOK_BY_CODE, BOOKS } from "@/lib/bible/books";
import { lxxLabel, psalmTitle } from "@/lib/bible/psalms";
import { messagesFor } from "@/lib/i18n/server";
import { loadChapter } from "@/lib/reader";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ code: string; chapter: string }> };

async function resolve(params: Params["params"]) {
  const { code, chapter } = await params;
  const book = BOOK_BY_CODE.get(code.toUpperCase());
  const n = Number(chapter);
  if (!book || !Number.isInteger(n) || n < 1 || n > (book.code === "PSA" ? 151 : book.chapters)) return null;
  return { book, chapter: n };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const r = await resolve(params);
  if (!r) return {};
  const { locale } = await getViewer();
  return { title: `${locale === "fr" ? r.book.name_fr : r.book.name_en} ${r.chapter}` };
}

/** A whole chapter, passage by passage, with the readings or the Fathers' commentary. */
export default async function ChapterPage({ params }: Params) {
  const r = await resolve(params);
  if (!r) notFound();
  const { book, chapter } = r;
  const { locale, profile } = await getViewer();
  const t = messagesFor(locale);
  const prefs = {
    bible_version_fr: profile?.bible_version_fr ?? "LSG1910",
    bible_version_en: profile?.bible_version_en ?? "WEB",
    show_greek: profile?.show_greek ?? false,
  };
  const blocks = await loadChapter(await createClient(), book.code, chapter, locale, prefs);
  if (blocks.length === 0) notFound();

  const name = locale === "fr" ? book.name_fr : book.name_en;
  const last = book.code === "PSA" ? 150 : book.chapters;
  const bookIndex = BOOKS.findIndex((b) => b.code === book.code);
  const prev = chapter > 1 ? `/books/${book.code}/${chapter - 1}` : BOOKS[bookIndex - 1] ? `/books/${BOOKS[bookIndex - 1]!.code}/${BOOKS[bookIndex - 1]!.code === "PSA" ? 150 : BOOKS[bookIndex - 1]!.chapters}` : null;
  const next = chapter < last ? `/books/${book.code}/${chapter + 1}` : BOOKS[bookIndex + 1] ? `/books/${BOOKS[bookIndex + 1]!.code}/1` : null;
  const title = book.code === "PSA" ? psalmTitle(chapter <= 150 ? chapter : null, chapter <= 150 ? lxxLabel(chapter) : "151", locale) : `${name} ${chapter}`;

  const nav = (
    <nav className="flex items-center justify-between gap-2 text-sm">
      {prev ? (
        <Link href={prev} className="btn-ghost" data-testid="chapter-prev">
          ← {t.reader.prevChapter}
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link href={next} className="btn-ghost" data-testid="chapter-next">
          {t.reader.nextChapter} →
        </Link>
      )}
    </nav>
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href={`/books/${book.code}`} className="text-sm text-muted hover:text-ink">
          ← {name}
        </Link>
        <h1 className="font-serif text-3xl font-bold" data-testid="chapter-title">
          {title}
        </h1>
      </div>
      {nav}
      {blocks.map((b) => (
        <section key={b.range.verseStart} className="card-surface flex flex-col gap-4 p-5 sm:p-6" data-testid="chapter-passage" aria-label={b.reference}>
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">{b.reference}</h2>
          <p className="font-serif text-lg leading-relaxed" lang={b.text.language}>
            {b.text.verses.map((v) => (
              <span key={`${v.chapter}:${v.verse}`}>
                <sup className="mr-0.5 select-none font-sans text-[0.65em] font-semibold text-muted">{v.verse}</sup>
                {v.text}{" "}
              </span>
            ))}
          </p>

          {b.card ? (
            <details open className="group">
              <summary className="cursor-pointer font-semibold text-accent">{t.reader.showReadings}</summary>
              <div className="mt-3">
                <LogionCard card={b.card} variant="compact" headingLevel="h3" hidePassage>
                  <Link href={`/cards/${b.card.id}`} className="text-sm font-medium text-accent underline-offset-4 hover:underline">
                    {t.reader.openCard} →
                  </Link>
                </LogionCard>
              </div>
            </details>
          ) : (
            <p className="text-sm text-muted">{t.reader.noCardYet}</p>
          )}

          {b.fathers.length > 0 && (
            <details className="rounded-2xl bg-surface-2 p-4" open={!b.card}>
              <summary className="cursor-pointer font-semibold">
                {t.reader.fathers} ({b.fathers.length})
              </summary>
              <p className="mt-1 text-xs text-muted">{t.reader.fathersNote}</p>
              <ul className="mt-3 flex flex-col gap-4">
                {b.fathers.map((f) => (
                  <li key={f.id} className="flex flex-col gap-1" data-testid="father-extract">
                    <p className="text-sm font-semibold">
                      {f.author}
                      {f.region && <span className="ml-2 chip">{f.region === "east" ? t.reader.east : t.reader.west}</span>}
                    </p>
                    <blockquote lang="en" className="whitespace-pre-line border-l-4 border-accent pl-3 text-sm leading-relaxed">
                      {f.text}
                    </blockquote>
                    <a href={f.url} target="_blank" rel="noreferrer" className="text-xs text-muted underline">
                      {f.work}, {f.section} · {t.reader.readSource}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      ))}
      {nav}
    </div>
  );
}
