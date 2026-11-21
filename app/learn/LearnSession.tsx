"use client";

import { useEffect, useState } from "react";
import { ErrorState, Spinner } from "@/components/States";
import type { CardSummary } from "@/lib/cards";
import { apiFetch, localDay } from "@/lib/client/api";
import { useT } from "@/lib/i18n/client";
import { maskWords } from "@/lib/learn";

type Item = { card: CardSummary; maskLevel: number };

export function LearnSession() {
  const t = useT();
  const [items, setItems] = useState<Item[] | null>(null);
  const [total, setTotal] = useState(0);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    apiFetch<{ total: number; items: Item[] }>("/api/learn")
      .then((d) => {
        setItems(d.items);
        setTotal(d.total);
      })
      .catch(() => setError(true));
  }, []);

  if (error) return <ErrorState />;
  if (!items) return <Spinner />;
  const item = items[index];
  if (!item) return <p className="text-muted">{total === 0 ? t.learn.empty : t.review.done}</p>;

  async function rate(rating: 1 | 2 | 3 | 4) {
    await apiFetch("/api/learn/review", { method: "POST", json: { cardId: item!.card.id, rating, day: localDay() } });
    setRevealed(false);
    setIndex((i) => i + 1);
  }

  return (
    <article className="card-surface flex flex-col gap-4 p-6" data-testid="learn-item">
      <div className="flex items-center justify-between gap-2 text-sm text-muted">
        <span>{t.learn.due(items.length - index)}</span>
        <span>{t.learn.level(item.maskLevel)}</span>
      </div>
      <h2 className="font-serif text-2xl font-bold">{item.card.reference}</h2>
      <p className="font-serif text-lg leading-relaxed">
        {(item.card.passage?.verses ?? []).map((v) => (
          <span key={`${v.chapter}:${v.verse}`}>
            <sup className="mr-0.5 text-[0.65em] text-muted">{v.verse}</sup>
            {maskWords(v.text, revealed ? 0 : item.maskLevel).map((tok, i) =>
              tok.hidden ? (
                <span key={i} className="rounded bg-surface-2 text-transparent" aria-label="…" data-testid="masked-word">
                  {tok.text}
                </span>
              ) : (
                <span key={i}>{tok.text}</span>
              ),
            )}{" "}
          </span>
        ))}
      </p>
      {!revealed ? (
        <button type="button" className="btn-primary w-fit" onClick={() => setRevealed(true)}>
          {t.learn.reveal}
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label={t.review.title}>
          {([1, 2, 3, 4] as const).map((r) => (
            <button key={r} type="button" className="btn-ghost" onClick={() => void rate(r)}>
              {t.review.ratings[r]}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}
