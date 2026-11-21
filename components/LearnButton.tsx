"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/client/api";
import { useT } from "@/lib/i18n/client";

export function LearnButton({ cardId }: { cardId: string }) {
  const t = useT();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost"
      disabled={done}
      data-testid="learn-verse"
      onClick={async () => {
        await apiFetch("/api/learn", { method: "POST", json: { cardId } });
        setDone(true);
      }}
    >
      {done ? t.learn.added : t.card.learnVerse}
    </button>
  );
}
