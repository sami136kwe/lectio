"use client";

import { useCallback, useState } from "react";
import type { CardSummary } from "@/lib/cards";
import { apiFetch } from "@/lib/client/api";

/** Per-card FR/EN switch: shows the other language of a card in place, without changing the reader's position. */
export function useCardFlip() {
  const [flipped, setFlipped] = useState<Record<string, CardSummary>>({});
  const show = useCallback((card: CardSummary | undefined) => (card ? (flipped[card.id!] ?? card) : undefined), [flipped]);
  const flip = useCallback(async (card: CardSummary) => {
    const id = card.id!;
    if (flipped[id]) {
      setFlipped((f) => Object.fromEntries(Object.entries(f).filter(([k]) => k !== id)));
      return;
    }
    const other = card.language === "en" ? "fr" : "en";
    const { cards } = await apiFetch<{ cards: CardSummary[] }>(`/api/cards?${new URLSearchParams({ ids: id, lang: other })}`);
    if (cards[0]) setFlipped((f) => ({ ...f, [id]: cards[0]! }));
  }, [flipped]);
  return { show, flip };
}
