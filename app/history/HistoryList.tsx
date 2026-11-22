"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LogionCard } from "@/components/LogionCard";
import { ReadMeta } from "@/components/ReadMeta";
import { EmptyState, ErrorState, Spinner } from "@/components/States";
import type { CardSummary } from "@/lib/cards";
import { apiFetch } from "@/lib/client/api";
import { useLocale, useT } from "@/lib/i18n/client";

export type CategoryNode = { id: string; name_fr: string; name_en: string; icon: string | null; children: { id: string; name_fr: string; name_en: string }[] };
export type ProgressRow = { category_id: string; name_fr: string; name_en: string; icon: string | null; seen: number; total: number };

type Item = { card: CardSummary; read_count: number; last_read_at: string; first_read_at: string; is_stashed: boolean };
type Response = { items: Item[]; total: number; hasMore: boolean };

const PAGE = 24;

/** Start of the local day as ISO (inclusive), and start of the next local day (exclusive). */
function dayStart(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toISOString();
}
function nextDayStart(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y!, m! - 1, d! + 1).toISOString();
}

export function HistoryList({ tree, progress }: { tree: CategoryNode[]; progress: ProgressRow[] }) {
  const t = useT();
  const locale = useLocale();
  const name = (c: { name_fr: string; name_en: string }) => (locale === "fr" ? c.name_fr : c.name_en);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [sub, setSub] = useState("");
  const [saved, setSaved] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const requestId = useRef(0);

  const subcategories = tree.find((c) => c.id === category)?.children ?? [];

  const fetchPage = useCallback(
    async (offset: number) => {
      const params = new URLSearchParams({ limit: String(PAGE), offset: String(offset), stashed: saved ? "1" : "0" });
      if (category) params.set("category", category);
      if (sub) params.set("sub", sub);
      if (from) params.set("from", dayStart(from));
      if (to) params.set("to", nextDayStart(to));
      if (q.trim().length >= 2) params.set("q", q.trim());
      return apiFetch<Response>(`/api/history?${params}`);
    },
    [q, category, sub, saved, from, to],
  );

  useEffect(() => {
    const id = ++requestId.current;
    const timer = window.setTimeout(async () => {
      setStatus("loading");
      try {
        const data = await fetchPage(0);
        if (id !== requestId.current) return;
        setItems(data.items);
        setTotal(data.total);
        setHasMore(data.hasMore);
        setStatus("ready");
      } catch {
        if (id === requestId.current) setStatus("error");
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [fetchPage]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const data = await fetchPage(items.length);
      setItems((prev) => [...prev, ...data.items.filter((i) => !prev.some((p) => p.card.id === i.card.id))]);
      setHasMore(data.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }

  const filtered = !!(q || category || sub || saved || from || to);
  const dateFmt = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="progress-title" className="flex flex-col gap-3">
        <h2 id="progress-title" className="text-lg font-semibold">
          {t.history.progress}
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {progress.map((row) => (
            <li key={row.category_id}>
              <button
                type="button"
                onClick={() => {
                  setCategory(category === row.category_id ? "" : row.category_id);
                  setSub("");
                }}
                aria-pressed={category === row.category_id}
                className={`flex w-full items-center justify-between gap-2 rounded-2xl border p-3 text-left text-sm ${
                  category === row.category_id ? "border-accent bg-accent-soft" : "border-line bg-surface hover:bg-surface-2"
                }`}
              >
                <span className="font-medium">
                  <span aria-hidden="true">{row.icon} </span>
                  {name(row)}
                </span>
                <span className="shrink-0 whitespace-nowrap text-muted">
                  {row.seen} / {row.total}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <label>
          <span className="sr-only">{t.history.search}</span>
          <input type="search" className="input" placeholder={t.history.search} value={q} onChange={(e) => setQ(e.target.value)} maxLength={100} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t.history.category}
            <select
              className="input font-normal"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setSub("");
              }}
            >
              <option value="">{t.history.allCategories}</option>
              {tree.map((c) => (
                <option key={c.id} value={c.id}>
                  {name(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t.history.subcategory}
            <select className="input font-normal" value={sub} onChange={(e) => setSub(e.target.value)} disabled={!category}>
              <option value="">{t.history.allSubcategories}</option>
              {subcategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {name(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t.history.from}
            <input type="date" className="input font-normal" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t.history.to}
            <input type="date" className="input font-normal" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
            {t.history.savedOnly}
          </label>
          {filtered && (
            <button
              type="button"
              className="text-sm text-muted underline underline-offset-4 hover:text-ink"
              onClick={() => {
                setQ("");
                setCategory("");
                setSub("");
                setSaved(false);
                setFrom("");
                setTo("");
              }}
            >
              {t.history.reset}
            </button>
          )}
        </div>
      </section>

      {status === "loading" && <Spinner />}
      {status === "error" && <ErrorState onRetry={() => setQ((v) => v + "")} />}
      {status === "ready" && (
        <>
          <p role="status" className="text-sm text-muted">
            {t.history.results(total)}
          </p>
          {items.length === 0 ? (
            <EmptyState title={filtered ? t.history.noMatch : t.history.empty} />
          ) : (
            <ul className="grid gap-4 lg:grid-cols-2">
              {items.map((item) => (
                <li key={item.card.id}>
                  <LogionCard card={item.card} variant="compact" headingLevel="h2">
                    <p className="text-xs text-muted">
                      {t.history.lastRead(dateFmt.format(new Date(item.last_read_at)))}
                      {item.is_stashed ? " · ★" : ""}
                    </p>
                    <ReadMeta cardId={item.card.id} readCount={item.read_count} />
                  </LogionCard>
                </li>
              ))}
            </ul>
          )}
          {hasMore && (
            <button type="button" className="btn-ghost self-center" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? t.common.loading : t.history.loadMore}
            </button>
          )}
        </>
      )}
    </div>
  );
}
