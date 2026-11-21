import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { formatReference } from "@/lib/bible/reference";
import type { ReviewExportRow } from "./review-csv";

type Db = SupabaseClient<Database>;

export type QueueFilters = { tradition?: string; book?: string; divergence?: boolean; status?: string };

export type QueueItem = {
  id: string;
  card_id: string;
  card_status: string;
  reference: string;
  language: string;
  tradition: string;
  body: string;
  divergence_type: string;
  divergence_topic: string | null;
  divergence_summary: string | null;
  review_status: string;
  reviewer_note: string | null;
  theology_score: number | null;
  sources: { usage: string; quote: string | null; author: string; work: string; section: string; url: string; text: string | null }[];
};

type Row = {
  id: string;
  card_id: string;
  language: string;
  tradition: string;
  body: string;
  divergence_type: string;
  divergence_topic: string | null;
  divergence_summary: string | null;
  review_status: string;
  reviewer_note: string | null;
  cards: { status: string; theology_score: number | null; passages: { book_code: string; chapter_start: number; verse_start: number; chapter_end: number; verse_end: number } };
  perspective_sources: { usage: string; quote: string | null; sources: { author: string; work: string; section: string; url: string; text: string | null } | null }[];
};

/** Readings waiting for (or having had) a human theological review. Service role only. */
export async function reviewQueue(db: Db, filters: QueueFilters, limit = 50): Promise<QueueItem[]> {
  let q = db
    .from("card_perspectives")
    .select(
      "id, card_id, language, tradition, body, divergence_type, divergence_topic, divergence_summary, review_status, reviewer_note, cards!inner(status, theology_score, passages!inner(book_code, chapter_start, verse_start, chapter_end, verse_end)), perspective_sources(usage, quote, sources(author, work, section, url, text))",
    )
    .in("tradition", ["catholic", "orthodox"])
    .neq("cards.status", "rejected")
    .eq("review_status", filters.status ?? "unreviewed")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (filters.tradition) q = q.eq("tradition", filters.tradition);
  if (filters.book) q = q.eq("cards.passages.book_code", filters.book);
  if (filters.divergence) q = q.eq("divergence_type", "differ");
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data as unknown as Row[]).map((r) => {
    const p = r.cards.passages;
    return {
      id: r.id,
      card_id: r.card_id,
      card_status: r.cards.status,
      reference: formatReference({ book: p.book_code, chapterStart: p.chapter_start, verseStart: p.verse_start, chapterEnd: p.chapter_end, verseEnd: p.verse_end }, r.language === "en" ? "en" : "fr"),
      language: r.language,
      tradition: r.tradition,
      body: r.body,
      divergence_type: r.divergence_type,
      divergence_topic: r.divergence_topic,
      divergence_summary: r.divergence_summary,
      review_status: r.review_status,
      reviewer_note: r.reviewer_note,
      theology_score: r.cards.theology_score,
      sources: r.perspective_sources.filter((s) => s.sources).map((s) => ({ usage: s.usage, quote: s.quote, ...s.sources! })),
    };
  });
}

export function toExportRows(items: QueueItem[]): ReviewExportRow[] {
  return items.map((i) => ({
    perspective_id: i.id,
    card_id: i.card_id,
    reference: i.reference,
    language: i.language,
    tradition: i.tradition,
    review_status: i.review_status,
    divergence_type: i.divergence_type,
    divergence_topic: i.divergence_topic ?? "",
    body: i.body,
    sources: i.sources.map((s) => `${s.author}, ${s.work}, ${s.section} (${s.usage})`).join(" | "),
    reviewer_note: i.reviewer_note ?? "",
  }));
}
