"use client";

import { useCallback, useEffect, useState } from "react";
import { LectioCard } from "@/components/LectioCard";
import { EmptyState, ErrorState, Spinner } from "@/components/States";
import type { CardSummary } from "@/lib/cards";
import { apiFetch, localDay } from "@/lib/client/api";
import { useT } from "@/lib/i18n/client";

type Rating = 1 | 2 | 3 | 4;

export function ReviewSession() {
  const t = useT();
  const [cards, setCards] = useState<CardSummary[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [pending, setPending] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ cards: CardSummary[] }>("/api/review");
      setCards(data.cards);
      setIndex(0);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function rate(rating: Rating) {
    const card = cards[index];
    if (!card || pending) return;
    setPending(true);
    try {
      const res = await apiFetch<{ intervalDays: number }>("/api/review", {
        method: "POST",
        json: { cardId: card.id, rating, day: localDay() },
      });
      setLastResult(`${t.review.ratings[rating]} · ${t.review.nextIn(res.intervalDays)}`);
      setRevealed(false);
      setIndex((i) => i + 1);
    } catch {
      setLastResult(t.common.error);
    } finally {
      setPending(false);
    }
  }

  if (status === "loading") return <Spinner />;
  if (status === "error") return <ErrorState onRetry={() => { setStatus("loading"); void load(); }} />;
  if (cards.length === 0) return <EmptyState title={t.review.empty} />;

  const card = cards[index];
  if (!card) {
    return (
      <EmptyState title={t.review.done}>
        <button type="button" className="btn-ghost" onClick={() => { setStatus("loading"); void load(); }}>
          {t.common.retry}
        </button>
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>{t.review.progress(index + 1, cards.length)}</span>
        <span role="status">{lastResult}</span>
      </div>
      {!revealed && <p className="font-medium">{t.review.question}</p>}
      <LectioCard key={card.id} card={card} hideContent={!revealed} headingLevel="h2" />
      {!revealed ? (
        <button type="button" className="btn-primary py-3" onClick={() => setRevealed(true)} autoFocus>
          {t.review.reveal}
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label={t.review.title}>
          {([1, 2, 3, 4] as Rating[]).map((r) => (
            <button key={r} type="button" className={r === 3 ? "btn-primary" : "btn-ghost"} disabled={pending} onClick={() => rate(r)}>
              {t.review.ratings[r]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
