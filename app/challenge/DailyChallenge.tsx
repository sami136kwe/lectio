"use client";

import { useCallback, useEffect, useState } from "react";
import { LectioCard } from "@/components/LectioCard";
import { EmptyState, ErrorState, Spinner } from "@/components/States";
import type { CardSummary } from "@/lib/cards";
import { apiFetch, localDay } from "@/lib/client/api";
import { useT } from "@/lib/i18n/client";

type ChallengeResponse = { card: CardSummary | null; completed: boolean; streak: number };

export function DailyChallenge() {
  const t = useT();
  const [data, setData] = useState<ChallengeResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ day: localDay(), tz: String(new Date().getTimezoneOffset()) });
      setData(await apiFetch<ChallengeResponse>(`/api/challenge?${params}`));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (status === "loading") return <Spinner />;
  if (status === "error" || !data) return <ErrorState onRetry={() => { setStatus("loading"); void load(); }} />;
  if (!data.card) return <EmptyState title={t.challenge.empty} />;
  const card = data.card;

  async function complete() {
    setPending(true);
    setData((d) => (d ? { ...d, completed: true } : d));
    try {
      const res = await apiFetch<{ streak: { streak_count: number } | null }>("/api/challenge", {
        method: "POST",
        json: { cardId: card.id, day: localDay() },
      });
      setData((d) => (d ? { ...d, streak: res.streak?.streak_count ?? d.streak } : d));
    } catch {
      setData((d) => (d ? { ...d, completed: false } : d));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="chip w-fit bg-accent-soft text-accent">🔥 {t.challenge.streak(data.streak)}</p>
      <LectioCard card={card} headingLevel="h2">
        <label
          className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 text-lg font-semibold ${
            data.completed ? "border-ok text-ok" : "border-line hover:bg-surface-2"
          }`}
        >
          <input
            type="checkbox"
            className="h-6 w-6 accent-[var(--accent)]"
            checked={data.completed}
            disabled={data.completed || pending}
            onChange={complete}
          />
          {data.completed ? t.challenge.completed : t.challenge.done}
        </label>
      </LectioCard>
    </div>
  );
}
