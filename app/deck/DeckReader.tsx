"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LogionCard } from "@/components/LogionCard";
import { ErrorState, Spinner } from "@/components/States";
import type { CardSummary } from "@/lib/cards";
import { apiFetch, localDay } from "@/lib/client/api";
import { useCardFlip } from "@/lib/client/useCardFlip";
import { useLocale, useT } from "@/lib/i18n/client";

type Deck = { date: string; position: number; cardIds: string[]; limit: "50" | "unlimited"; seenPositions: number[] };

/** The deck of the day, read like a story: forward, back, position kept across visits. */
export function DeckReader({ day }: { day: string | null }) {
  const t = useT();
  const locale = useLocale();
  const today = localDay();
  const date = day ?? today;
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Record<string, CardSummary>>({});
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const { show, flip } = useCardFlip();
  const loading = useRef(new Set<string>());

  const loadCards = useCallback(
    async (ids: string[]) => {
      const missing = ids.filter((id) => !cards[id] && !loading.current.has(id));
      if (!missing.length) return;
      missing.forEach((id) => loading.current.add(id));
      const { cards: got } = await apiFetch<{ cards: CardSummary[] }>(`/api/cards?${new URLSearchParams({ ids: missing.join(","), lang: locale })}`);
      setCards((c) => ({ ...c, ...Object.fromEntries(got.map((x) => [x.id!, x])) }));
    },
    [cards, locale],
  );

  const move = useCallback(
    async (position: number) => {
      const next = await apiFetch<Deck>("/api/deck", { method: "POST", json: { day: date, position, today } });
      setDeck(next);
    },
    [date, today],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await apiFetch<Deck>(`/api/deck?${new URLSearchParams({ day: date, today: date === today ? "1" : "0" })}`);
        if (cancelled) return;
        setDeck(d);
        setStatus("ready");
        if (d.cardIds.length && !d.seenPositions.includes(d.position)) await move(d.position);
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // Load the current card and its neighbours.
  useEffect(() => {
    if (!deck) return;
    const i = deck.position - 1;
    void loadCards(deck.cardIds.slice(Math.max(0, i - 1), i + 3)).catch(() => setStatus("error"));
  }, [deck, loadCards]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!deck || (e.target as HTMLElement)?.closest("input, textarea, select")) return;
      if (e.key === "ArrowRight" && deck.position < deck.cardIds.length) void move(deck.position + 1);
      if (e.key === "ArrowLeft" && deck.position > 1) void move(deck.position - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deck, move]);

  if (status === "loading") return <Spinner />;
  if (status === "error" || !deck) return <ErrorState />;
  const total = deck.limit === "50" || date !== today ? deck.cardIds.length : null;
  const current = show(cards[deck.cardIds[deck.position - 1] ?? ""]);
  const atEnd = deck.position >= deck.cardIds.length;
  const dateLabel = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-serif text-2xl font-bold">{t.deck.title}</h1>
          <p className="text-sm text-muted">{dateLabel}</p>
        </div>
        <Link href="/deck/history" className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
          {t.deck.previousDays}
        </Link>
      </div>
      {deck.cardIds.length === 0 ? (
        <p className="text-muted">{t.deck.empty}</p>
      ) : (
        <>
          <p className="text-sm text-muted" data-testid="deck-position">
            {t.deck.position(deck.position, total)}
          </p>
          {current ? (
            <LogionCard key={`${current.id}-${current.language}`} card={current} headingLevel="h2" onFlipLanguage={() => void flip(current)} />
          ) : (
            <Spinner />
          )}
          <div className="flex items-center justify-between gap-2">
            <button type="button" className="btn-ghost" disabled={deck.position <= 1} onClick={() => void move(deck.position - 1)} data-testid="deck-prev">
              ← {t.common.previous}
            </button>
            <button type="button" className="btn-primary" disabled={atEnd} onClick={() => void move(deck.position + 1)} data-testid="deck-next">
              {t.common.next} →
            </button>
          </div>
          {atEnd && <p className="text-center text-sm text-muted">{total === null ? t.deck.unlimitedMore : t.deck.finished}</p>}
        </>
      )}
    </div>
  );
}
