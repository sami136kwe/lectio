"use client";

import Link from "next/link";
import type { CardSummary } from "@/lib/cards";
import { LectioCard } from "./LectioCard";
import { useT } from "@/lib/i18n/client";

export function CardGrid({ cards }: { cards: CardSummary[] }) {
  const t = useT();
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {cards.map((card) => (
        <li key={card.id}>
          <LectioCard card={card} variant="compact" headingLevel="h3">
            <Link href={`/cards/${card.id}`} className="text-sm font-medium text-accent underline-offset-4 hover:underline">
              {t.common.openCard} →
            </Link>
          </LectioCard>
        </li>
      ))}
    </ul>
  );
}
