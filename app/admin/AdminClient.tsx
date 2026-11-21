"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LectioCard } from "@/components/LectioCard";
import type { QueueItem } from "@/lib/admin/queue";
import type { CardSummary } from "@/lib/cards";
import { apiFetch } from "@/lib/client/api";
import { useT } from "@/lib/i18n/client";

export type AdminCard = { card: CardSummary; status: string; scores: (number | null)[] };

/** Sample and drafts: the whole card with its sources, and publish / reject. */
export function AdminCards({ cards }: { cards: AdminCard[] }) {
  const t = useT();
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  if (cards.length === 0) return <p className="text-muted">{t.admin.empty}</p>;

  async function decide(id: string, status: "published" | "rejected") {
    const previous = statuses[id];
    setStatuses((s) => ({ ...s, [id]: status }));
    try {
      await apiFetch("/api/admin/cards", { method: "PATCH", json: { cardId: id, status } });
    } catch {
      setStatuses((s) => ({ ...s, [id]: previous ?? "" }));
    }
  }

  return (
    <ul className="grid gap-4 xl:grid-cols-2">
      {cards.map(({ card, status: initial, scores }) => {
        const status = statuses[card.id!] || initial;
        return (
          <li key={card.id}>
            <LectioCard card={card} variant="compact" headingLevel="h3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className={`chip ${status === "published" ? "text-ok" : status === "rejected" ? "text-danger" : ""}`}>{status}</span>
                <span className="chip">
                  {t.admin.scores}: {scores.map((s) => s ?? "–").join(" / ")}
                </span>
                <button type="button" className="btn-ghost py-1.5" disabled={status === "published"} onClick={() => decide(card.id!, "published")}>
                  {t.admin.approve}
                </button>
                <button type="button" className="btn-ghost py-1.5 text-danger" disabled={status === "rejected"} onClick={() => decide(card.id!, "rejected")}>
                  {t.admin.reject}
                </button>
              </div>
            </LectioCard>
          </li>
        );
      })}
    </ul>
  );
}

function QueueEntry({ item }: { item: QueueItem }) {
  const t = useT();
  const [body, setBody] = useState(item.body);
  const [note, setNote] = useState(item.reviewer_note ?? "");
  const [status, setStatus] = useState(item.review_status);
  const [busy, setBusy] = useState(false);

  async function save(review_status: "reviewed" | "corrected" | "rejected") {
    setBusy(true);
    try {
      await apiFetch("/api/admin/perspectives", {
        method: "PATCH",
        json: { perspectiveId: item.id, review_status, ...(review_status === "corrected" ? { body } : {}), reviewer_note: note || null },
      });
      setStatus(review_status);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="card-surface grid gap-4 p-4 text-sm lg:grid-cols-2" lang={item.language} data-testid="review-item">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{item.reference}</span>
          <span className="chip uppercase">{item.language}</span>
          <span className="chip">{item.tradition === "catholic" ? t.card.catholic : t.card.orthodox}</span>
          {item.divergence_type === "differ" && <span className="chip">{t.card.differ}{item.divergence_topic ? ` · ${item.divergence_topic}` : ""}</span>}
          <span className="chip">{t.admin.reviewStatus[status]}</span>
          <span className="chip">θ {item.theology_score ?? "–"}</span>
        </div>
        <label className="flex flex-col gap-1">
          <span className="sr-only">{t.card.view}</span>
          <textarea className="input min-h-40" value={body} onChange={(e) => setBody(e.target.value)} maxLength={1400} />
        </label>
        <label className="flex flex-col gap-1">
          {t.admin.note}
          <textarea className="input min-h-16" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost py-1.5" disabled={busy} onClick={() => save("reviewed")}>
            {t.admin.markReviewed}
          </button>
          <button type="button" className="btn-ghost py-1.5" disabled={busy || body === item.body || body.length < 80} onClick={() => save("corrected")}>
            {t.admin.saveCorrection}
          </button>
          <button type="button" className="btn-ghost py-1.5 text-danger" disabled={busy} onClick={() => save("rejected")}>
            {t.admin.rejectReading}
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted">{t.admin.sourcesUsed}</h3>
        {item.sources.length === 0 ? (
          <p className="text-muted">{t.admin.noSources}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {item.sources.map((s) => (
              <li key={`${s.author}${s.work}${s.section}`} className="rounded-xl bg-surface-2 p-3">
                <a href={s.url} target="_blank" rel="noreferrer" className="font-medium underline">
                  {s.author}, {s.work}, {s.section}
                </a>{" "}
                <span className="text-muted">({s.usage})</span>
                {s.quote && <p className="mt-1 italic">« {s.quote} »</p>}
                {s.text && <p className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap text-xs text-muted">{s.text}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

/** Theological review queue, with CSV re-import. */
export function ReviewQueue({ items }: { items: QueueItem[] }) {
  const t = useT();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  async function importCsv(file: File) {
    const res = await fetch("/api/admin/review/import", { method: "POST", headers: { "Content-Type": "text/csv" }, body: await file.text() });
    const data = (await res.json()) as { updated?: number; errors?: string[]; error?: string };
    setMessage(res.ok ? `${t.admin.imported(data.updated ?? 0)}${data.errors?.length ? ` · ${data.errors.slice(0, 5).join(" · ")}` : ""}` : (data.error ?? t.common.error));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex w-fit items-center gap-2 text-sm">
        <span className="btn-ghost py-1.5">{t.admin.importCsv}</span>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && void importCsv(e.target.files[0])} />
      </label>
      {message && (
        <p role="status" className="text-sm text-muted">
          {message}
        </p>
      )}
      {items.length === 0 ? (
        <p className="text-muted">{t.admin.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((i) => (
            <QueueEntry key={i.id} item={i} />
          ))}
        </ul>
      )}
    </div>
  );
}
