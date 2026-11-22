"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogionCard } from "@/components/LogionCard";
import type { CardSummary } from "@/lib/cards";
import { apiFetch, localDay } from "@/lib/client/api";
import { useT } from "@/lib/i18n/client";

export function ReadInOrder({ card, bookCode, previousHref }: { card: CardSummary; bookCode: string; previousHref: string | null }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function next() {
    setBusy(true);
    try {
      await apiFetch("/api/reading", { method: "POST", json: { cardId: card.id, day: localDay() } });
      router.push(`/books/${bookCode}/read`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <LogionCard key={card.id} card={card} headingLevel="h1">
      <div className="flex items-center justify-between gap-2">
        {previousHref ? (
          <Link href={previousHref} className="btn-ghost">
            ← {t.common.previous}
          </Link>
        ) : (
          <span />
        )}
        <button type="button" className="btn-primary" onClick={next} disabled={busy} data-testid="reading-next">
          {t.common.next} →
        </button>
      </div>
    </LogionCard>
  );
}
