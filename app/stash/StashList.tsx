"use client";

import { useMemo, useState } from "react";
import { LogionCard } from "@/components/LogionCard";
import { EmptyState } from "@/components/States";
import type { CardSummary } from "@/lib/cards";
import type { MainCategory } from "@/lib/categories";
import { apiFetch } from "@/lib/client/api";
import { useLocale, useT } from "@/lib/i18n/client";

type Props = { initialCards: CardSummary[]; initialNotes: Record<string, string>; categories: MainCategory[] };

function fold(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function NoteEditor({ cardId, initial }: { cardId: string; initial: string }) {
  const t = useT();
  const [note, setNote] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const id = `note-${cardId}`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold">
        {t.stash.note}
      </label>
      <textarea
        id={id}
        className="input min-h-20"
        maxLength={2000}
        placeholder={t.stash.notePlaceholder}
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setState("idle");
        }}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn-ghost py-1.5"
          disabled={note === saved || state === "saving"}
          onClick={async () => {
            setState("saving");
            try {
              await apiFetch("/api/stash", { method: "PATCH", json: { cardId, note } });
              setSaved(note);
              setState("saved");
            } catch {
              setState("error");
            }
          }}
        >
          {t.common.save}
        </button>
        <span role="status" className="text-sm text-muted">
          {state === "saved" ? t.common.saved : state === "error" ? t.common.error : ""}
        </span>
      </div>
    </div>
  );
}

export function StashList({ initialCards, initialNotes, categories }: Props) {
  const t = useT();
  const locale = useLocale();
  const [cards, setCards] = useState(initialCards);
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = fold(query.trim());
    return cards.filter(
      (c) =>
        (!category || c.main_category_id === category) &&
        (!q || fold(`${c.reference} ${c.passage?.verses.map((v) => v.text).join(" ") ?? ""} ${c.plain_explanation} ${c.action_step} ${initialNotes[c.id!] ?? ""}`).includes(q)),
    );
  }, [cards, category, query, initialNotes]);

  if (cards.length === 0) return <EmptyState title={t.stash.empty} />;

  const usedCategories = categories.filter((c) => cards.some((card) => card.main_category_id === c.id));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex-1">
          <span className="sr-only">{t.stash.search}</span>
          <input type="search" className="input" placeholder={t.stash.search} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label>
          <span className="sr-only">{t.stash.allCategories}</span>
          <select className="input sm:w-64" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">{t.stash.allCategories}</option>
            {usedCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {locale === "fr" ? c.name_fr : c.name_en}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-sm text-muted" role="status">
        {t.stash.count(visible.length)}
      </p>
      {visible.length === 0 ? (
        <EmptyState title={t.stash.noMatch} />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {visible.map((card) => (
            <li key={card.id}>
              <LogionCard card={card} variant="compact" headingLevel="h2">
                <NoteEditor cardId={card.id} initial={initialNotes[card.id] ?? ""} />
                <button
                  type="button"
                  className="btn-danger self-start py-1.5"
                  onClick={async () => {
                    const previous = cards;
                    setCards((list) => list.filter((c) => c.id !== card.id));
                    try {
                      await apiFetch("/api/stash", { method: "DELETE", json: { cardId: card.id } });
                    } catch {
                      setCards(previous);
                    }
                  }}
                >
                  {t.stash.remove}
                </button>
              </LogionCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
