"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CardGrid } from "@/components/CardGrid";
import { ErrorState, Spinner } from "@/components/States";
import type { PassageText } from "@/lib/bible/passage";
import type { CardSummary } from "@/lib/cards";
import { apiFetch } from "@/lib/client/api";
import { useLocale, useT } from "@/lib/i18n/client";

type Results = {
  reference: { label: string; cards: CardSummary[]; text: PassageText | null; firstCardId: string | null } | null;
  cards: CardSummary[];
  verses: { book_code: string; chapter: number; verse: number; text: string; label: string }[];
  categories: { id: string; slug: string; name_fr: string; name_en: string; icon: string | null; parent_id: string | null }[];
};

export function SearchClient({ initialQuery }: { initialQuery: string }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Results | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    const q = query.trim();
    const url = new URL(window.location.href);
    if (q) url.searchParams.set("q", q);
    else url.searchParams.delete("q");
    window.history.replaceState(null, "", url);
    if (q.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults(null);
      setStatus("idle");
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setStatus("loading");
      try {
        const data = await apiFetch<Results>(`/api/search?${new URLSearchParams({ q })}`, { signal: controller.signal });
        setResults(data);
        setStatus("idle");
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("error");
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  const ref = results?.reference ?? null;
  const empty = results && !ref && results.cards.length === 0 && results.verses.length === 0 && results.categories.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          // Enter on a reference opens the card directly.
          if (ref?.firstCardId) router.push(`/cards/${ref.firstCardId}`);
        }}
      >
        <label>
          <span className="sr-only">{t.search.placeholder}</span>
          <input
            type="search"
            className="input py-3 text-lg"
            placeholder={t.search.placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            maxLength={100}
            name="q"
          />
        </label>
      </form>

      {status === "loading" && <Spinner />}
      {status === "error" && <ErrorState />}
      {query.trim().length > 0 && query.trim().length < 2 && <p className="text-muted">{t.search.hint}</p>}
      {empty && status === "idle" && <p className="text-muted">{t.search.empty}</p>}

      {results && status === "idle" && (
        <>
          {ref && (
            <section className="flex flex-col gap-3" data-testid="reference-result">
              <h2 className="text-xl font-semibold">
                {t.search.reference} : {ref.label}
              </h2>
              {ref.cards.length > 0 ? (
                <CardGrid cards={ref.cards} />
              ) : ref.text ? (
                <div className="card-surface p-5">
                  <p className="mb-2 text-sm text-muted">{t.search.noCardForRef}</p>
                  <p className="font-serif text-lg leading-relaxed">
                    {ref.text.verses.map((v) => (
                      <span key={`${v.chapter}:${v.verse}`}>
                        <sup className="mr-0.5 text-[0.65em] text-muted">{v.verse}</sup>
                        {v.text}{" "}
                      </span>
                    ))}
                  </p>
                  <p className="mt-2 text-xs text-muted">{t.card.versionNote(ref.text.versionName)}</p>
                </div>
              ) : (
                <p className="text-muted">{t.search.empty}</p>
              )}
            </section>
          )}
          {results.categories.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-xl font-semibold">{t.search.categories}</h2>
              <ul className="flex flex-wrap gap-2">
                {results.categories.map((c) => (
                  <li key={c.id}>
                    <Link href={`/categories/${c.slug}`} className="chip text-sm hover:text-ink">
                      {c.icon && <span aria-hidden="true">{c.icon}</span>}
                      {locale === "fr" ? c.name_fr : c.name_en}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {results.cards.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-xl font-semibold">{t.search.cards}</h2>
              <CardGrid cards={results.cards} />
            </section>
          )}
          {results.verses.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-xl font-semibold">{t.search.verses}</h2>
              <ul className="flex flex-col gap-2">
                {results.verses.map((v) => (
                  <li key={`${v.book_code}${v.chapter}:${v.verse}`} className="card-surface p-3">
                    <button type="button" className="text-left" onClick={() => setQuery(v.label)}>
                      <span className="font-semibold">{v.label}</span> <span className="font-serif">{v.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
