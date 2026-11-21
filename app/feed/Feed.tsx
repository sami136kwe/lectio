"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LectioCard, toSpeakable } from "@/components/LectioCard";
import { ReadMeta } from "@/components/ReadMeta";
import { SpeakButton } from "@/components/SpeakButton";
import { VoicePicker } from "@/components/VoicePicker";
import { EmptyState, ErrorState, Spinner } from "@/components/States";
import type { CardSummary } from "@/lib/cards";
import { apiFetch, localDay, localMidnightIso } from "@/lib/client/api";
import { useT } from "@/lib/i18n/client";
import { useAutoReadPref } from "@/lib/tts/prefs";
import { useReadAloud } from "@/lib/tts/useReadAloud";

type FeedCard = CardSummary & { discovery?: boolean; reread?: boolean; read_count?: number | null };
type FeedResponse = {
  cards: FeedCard[];
  todayCount?: number;
  rereadToday?: number;
  fallback?: boolean;
  includeReread?: boolean;
  rereadRatio?: number;
};

export type RereadMode = "random" | "oldest" | "least" | "stashed";
type Props = {
  dailyGoal: number;
  /** "feed": new cards (plus re-reads if enabled). "reread": only cards already read. */
  mode?: "feed" | "reread";
  rereadQuery?: { mode: RereadMode; category?: string };
};

const PAGE_SIZE = 10;
const SWIPE_THRESHOLD = 60;

export function Feed({ dailyGoal, mode = "feed", rereadQuery }: Props) {
  const t = useT();
  const rereadMode = rereadQuery?.mode ?? "random";
  const rereadCategory = rereadQuery?.category;
  const [cards, setCards] = useState<FeedCard[]>([]);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [exhausted, setExhausted] = useState(false);
  const [seenToday, setSeenToday] = useState(0);
  const [rereadCount, setRereadCount] = useState(0);
  const [fallback, setFallback] = useState(false);
  const [includeReread, setIncludeReread] = useState(false);
  const [rereadRatio, setRereadRatio] = useState(20);
  const [stashed, setStashed] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const loadingMore = useRef(false);
  const cardsRef = useRef<FeedCard[]>([]);
  const indexRef = useRef(0);
  const seenIds = useRef(new Set<string>());
  const touchStart = useRef<number | null>(null);
  const wheelLock = useRef(0);

  const markSeen = useCallback((card: FeedCard | undefined) => {
    if (!card || seenIds.current.has(card.id)) return;
    seenIds.current.add(card.id);
    // Re-reads are a bonus: logged apart, never counted for the goal or the streak.
    const action = card.reread ? "reread" : "seen";
    if (card.reread) setRereadCount((n) => n + 1);
    else setSeenToday((n) => n + 1);
    void apiFetch("/api/views", { method: "POST", json: { cardId: card.id, action, day: localDay() } }).catch(() => {});
  }, []);

  const load = useCallback(
    async (initial: boolean) => {
      if (loadingMore.current) return;
      loadingMore.current = true;
      try {
        let url: string;
        if (mode === "reread") {
          const params = new URLSearchParams({ size: String(PAGE_SIZE), mode: rereadMode });
          if (rereadCategory) params.set("category", rereadCategory);
          const shown = cardsRef.current.map((c) => c.id).slice(-150);
          if (shown.length) params.set("exclude", shown.join(","));
          url = `/api/reread?${params}`;
        } else {
          const params = new URLSearchParams({ size: String(PAGE_SIZE), since: localMidnightIso() });
          const shown = cardsRef.current.map((c) => c.id).slice(-150);
          if (shown.length) params.set("exclude", shown.join(","));
          url = `/api/feed?${params}`;
        }
        const data = await apiFetch<FeedResponse>(url);
        const fresh = data.cards.filter((c) => !cardsRef.current.some((k) => k.id === c.id));
        if (fresh.length === 0) setExhausted(true);
        cardsRef.current = [...cardsRef.current, ...fresh];
        setCards(cardsRef.current);
        if (initial) {
          if (mode === "feed") {
            setSeenToday(data.todayCount ?? 0);
            setRereadCount(data.rereadToday ?? 0);
            setIncludeReread(data.includeReread ?? false);
            setRereadRatio(data.rereadRatio ?? 20);
          }
          markSeen(cardsRef.current[0]);
        }
        // Later pages can switch to re-reading once the new cards run out.
        if (data.fallback) setFallback(true);
        setStatus("ready");
      } catch {
        if (initial) setStatus("error");
      } finally {
        loadingMore.current = false;
      }
    },
    [markSeen, mode, rereadMode, rereadCategory],
  );

  /** Starts the stream over (after the re-read setting changed). */
  const reset = useCallback(() => {
    cardsRef.current = [];
    indexRef.current = 0;
    setCards([]);
    setIndex(0);
    setExhausted(false);
    setStatus("loading");
    void load(true);
  }, [load]);

  async function saveRereadSetting(next: { include_reread?: boolean; reread_ratio?: number }) {
    if (next.include_reread !== undefined) setIncludeReread(next.include_reread);
    if (next.reread_ratio !== undefined) setRereadRatio(next.reread_ratio);
    try {
      await apiFetch("/api/profile", { method: "PATCH", json: next });
      reset();
    } catch {
      showToast(t.common.error);
    }
  }

  useEffect(() => {
    // Initial fetch from the API (an external system); state updates happen after the response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(true);
  }, [load]);

  const current = cards[index];
  const [autoRead, setAutoRead] = useAutoReadPref();
  const audio = useReadAloud(current ? toSpeakable(current) : undefined, { autoPlay: autoRead });
  const nextCard = cards[index + 1];
  const prefetchNext = audio.prefetch;
  const wantsAudio = autoRead || audio.state !== "idle";
  useEffect(() => {
    // While listening (or with auto-read on), the next card's voice is requested in advance.
    if (wantsAudio && nextCard) prefetchNext(toSpeakable(nextCard));
  }, [wantsAudio, nextCard, prefetchNext]);

  const go = useCallback(
    (delta: number) => {
      const list = cardsRef.current;
      const max = exhausted ? list.length : Math.max(0, list.length - 1);
      const next = Math.min(Math.max(0, indexRef.current + delta), max);
      indexRef.current = next;
      setIndex(next);
      markSeen(list[next]);
      if (!exhausted && next >= list.length - 3) void load(false);
    },
    [exhausted, load, markSeen],
  );

  const showToast = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 2000);
  };

  const stash = useCallback(async () => {
    if (!current || stashed.has(current.id)) return;
    setStashed((s) => new Set(s).add(current.id));
    try {
      await apiFetch("/api/stash", { method: "POST", json: { cardId: current.id, day: localDay() } });
      showToast(t.feed.stashed);
    } catch {
      setStashed((s) => {
        const next = new Set(s);
        next.delete(current.id);
        return next;
      });
      showToast(t.common.error);
    }
  }, [current, stashed, t]);

  const skip = useCallback(() => {
    if (!current) return;
    void apiFetch("/api/views", { method: "POST", json: { cardId: current.id, action: "skipped", day: localDay() } }).catch(() => {});
    go(1);
  }, [current, go]);

  const share = useCallback(async () => {
    if (!current) return;
    const url = `${window.location.origin}/cards/${current.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: current.reference, text: current.action_step ?? "", url });
      } else {
        await navigator.clipboard.writeText(url);
        showToast(t.feed.linkCopied);
      }
    } catch {
      // Share sheet dismissed: nothing to do.
    }
  }, [current, t]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "s") {
        void stash();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, stash]);

  if (status === "loading") return <Spinner />;
  if (status === "error") return <ErrorState onRetry={() => { setStatus("loading"); void load(true); }} />;

  const isReread = mode === "reread";
  const goalReached = !isReread && seenToday >= dailyGoal;
  const atEnd = index >= cards.length;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      {isReread ? (
        <p className="text-sm font-medium text-muted" role="status">
          {t.reread.session(rereadCount)}
        </p>
      ) : (
        <div className="flex items-center gap-3">
          <h1 className="sr-only">{t.feed.title}</h1>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={dailyGoal} aria-valuenow={Math.min(seenToday, dailyGoal)} aria-label={t.feed.goal(seenToday, dailyGoal)}>
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.min(100, (seenToday / dailyGoal) * 100)}%` }} />
          </div>
          <span className="text-sm font-medium text-muted">{t.feed.goal(seenToday, dailyGoal)}</span>
        </div>
      )}
      {!isReread && rereadCount > 0 && <p className="text-xs text-muted">{t.feed.rereadBonus(rereadCount)}</p>}
      {!isReread && fallback && (
        <p role="status" className="rounded-2xl bg-surface-2 px-4 py-2 text-sm text-muted">
          {t.feed.fallback}
        </p>
      )}
      {goalReached && (
        <p role="status" className="rounded-2xl bg-accent-soft px-4 py-2 text-sm font-medium text-accent">
          {t.feed.goalReached}
        </p>
      )}

      {atEnd || !current ? (
        <EmptyState title={isReread ? (cards.length === 0 ? t.reread.empty : t.reread.done) : t.feed.empty} />
      ) : (
        <div
          className="min-h-[60dvh] touch-pan-x select-text"
          onTouchStart={(e) => (touchStart.current = e.touches[0]?.clientY ?? null)}
          onTouchEnd={(e) => {
            const start = touchStart.current;
            const end = e.changedTouches[0]?.clientY;
            touchStart.current = null;
            if (start == null || end == null) return;
            if (start - end > SWIPE_THRESHOLD) go(1);
            else if (end - start > SWIPE_THRESHOLD) go(-1);
          }}
          onWheel={(e) => {
            const now = Date.now();
            if (Math.abs(e.deltaY) < 40 || now - wheelLock.current < 600) return;
            wheelLock.current = now;
            go(e.deltaY > 0 ? 1 : -1);
          }}
          aria-live="polite"
        >
          <p className="sr-only">{t.feed.position(index + 1, cards.length)}</p>
          <LectioCard key={current.id} card={current} discovery={current.discovery} headingLevel="h2" reading={audio.reading}>
            {current.reread && <ReadMeta cardId={current.id} readCount={current.read_count ?? 1} />}
          </LectioCard>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5">
          <button type="button" className="btn-ghost px-3" onClick={() => go(-1)} disabled={index === 0} aria-label={t.common.previous} title={t.common.previous}>
            <span aria-hidden="true">↑</span>
          </button>
          <button type="button" className="btn-ghost px-3" onClick={() => go(1)} disabled={atEnd} aria-label={t.common.next} title={t.common.next}>
            <span aria-hidden="true">↓</span>
          </button>
        </div>
        {current && !atEnd && (
          <div className="flex gap-1.5">
            <SpeakButton state={audio.state} onToggle={audio.toggle} />
            <button type="button" className="btn-ghost px-3 sm:px-4" onClick={skip}>
              {t.feed.skip}
            </button>
            <button type="button" className="btn-ghost px-3 sm:px-4" onClick={share} aria-label={t.feed.share} title={t.feed.share}>
              <span aria-hidden="true">↗</span>
              <span className="hidden sm:inline">{t.feed.share}</span>
            </button>
            <button
              type="button"
              className={stashed.has(current.id) ? "btn-ghost px-3 text-accent sm:px-4" : "btn-primary px-3 sm:px-4"}
              onClick={stash}
              aria-pressed={stashed.has(current.id)}
            >
              <span aria-hidden="true">★</span> {stashed.has(current.id) ? t.feed.stashed : t.feed.stash}
            </button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={autoRead} onChange={(e) => setAutoRead(e.target.checked)} />
          {t.common.autoRead}
        </label>
        <VoicePicker language={audio.language} voice={audio.voice} onChange={audio.setVoice} />
      </div>
      {!isReread && (
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--accent)]"
              checked={includeReread}
              onChange={(e) => void saveRereadSetting({ include_reread: e.target.checked })}
            />
            {t.feed.includeReread}
          </label>
          {includeReread && (
            <label className="flex items-center gap-2 text-sm text-muted">
              {t.feed.mixLabel}
              <select
                className="input w-auto py-1.5 text-sm"
                value={rereadRatio}
                onChange={(e) => void saveRereadSetting({ reread_ratio: Number(e.target.value) })}
              >
                {[10, 20, 30, 50].map((r) => (
                  <option key={r} value={r}>
                    {t.feed.mix(r)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
      {!isReread && (
        <nav aria-label={t.nav.history} className="flex justify-center gap-5 text-sm">
          <Link href="/history" className="text-accent underline-offset-4 hover:underline">
            {t.nav.history}
          </Link>
          <Link href="/reread" className="text-accent underline-offset-4 hover:underline">
            {t.nav.reread}
          </Link>
        </nav>
      )}
      <p className="text-center text-xs text-muted">{t.feed.swipeHint}</p>

      {toast && (
        <div role="status" className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-bg shadow-lg md:bottom-8">
          {toast}
        </div>
      )}
    </div>
  );
}
