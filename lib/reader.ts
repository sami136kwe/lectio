/**
 * Chapter reader: the whole text of a chapter, cut into passages. A passage
 * that has a card shows its readings; any other passage shows the verified
 * extracts of the Church Fathers that comment on it, so every part of the
 * New Testament can be read with something to understand it.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { referenceText, textWithFallback, type PassageText } from "@/lib/bible/passage";
import { TITLE_VERSES } from "@/lib/bible/psalms";
import { formatReference, verseKey, type Range } from "@/lib/bible/reference";
import { assembleCards, CARD_FIELDS, versionPlan, type CardRow, type CardSummary, type ReadingPrefs } from "@/lib/cards";
import { segmentChapter, type Segment } from "@/lib/pipeline/segment";

type Db = SupabaseClient<Database>;

export type FatherExtract = { id: string; author: string; work: string; section: string; url: string; region: string | null; text: string };

export type ChapterBlock = {
  range: Range;
  reference: string;
  text: PassageText;
  card: CardSummary | null;
  fathers: FatherExtract[];
};

/**
 * Passages of a chapter: the passages of existing cards first, then the
 * remaining verses cut by the same rules as the generation pipeline.
 * Every verse belongs to exactly one block.
 */
export function chapterBlocks(verses: { verse: number; text: string }[], cardRanges: Segment[], opts: { psalm?: boolean; titleVerses?: number } = {}): (Segment & { carded: boolean })[] {
  const taken: (Segment & { carded: boolean })[] = [];
  for (const r of [...cardRanges].sort((a, b) => a.start - b.start)) {
    if (taken.some((t) => t.start <= r.end && t.end >= r.start)) continue; // overlapping cards: the first one wins
    taken.push({ ...r, carded: true });
  }
  const out: (Segment & { carded: boolean })[] = [];
  let gap: { verse: number; text: string }[] = [];
  const flush = () => {
    if (!gap.length) return;
    const first = gap[0]!.verse === verses[0]?.verse;
    for (const s of segmentChapter(gap, { psalm: opts.psalm, titleVerses: first ? opts.titleVerses : 0 })) out.push({ ...s, carded: false });
    gap = [];
  };
  for (const v of verses) {
    const card = taken.find((t) => t.start === v.verse);
    if (card) {
      flush();
      out.push(card);
      continue;
    }
    if (taken.some((t) => v.verse > t.start && v.verse <= t.end)) continue;
    gap.push(v);
  }
  flush();
  return out;
}

const EXTRACTS_PER_PASSAGE = 3;
const EXTRACT_CHARS = 700;

export async function loadChapter(db: Db, book: string, chapter: number, language: "fr" | "en", prefs: ReadingPrefs): Promise<ChapterBlock[]> {
  const whole: Range = { book, chapterStart: chapter, verseStart: 1, chapterEnd: chapter, verseEnd: 200 };
  const reference = await referenceText(db, whole);
  if (reference.verses.length === 0) return [];

  // Published cards whose passage lies in this chapter.
  const { data: rows, error } = await db
    .from("card_details")
    .select(CARD_FIELDS)
    .eq("book_code", book)
    .eq("chapter_start", chapter)
    .eq("chapter_end", chapter)
    .eq("language", language)
    .eq("status", "published")
    .order("sort_key");
  if (error) throw new Error(error.message);
  const firstCardOf = new Map<number, CardRow>();
  for (const r of rows as CardRow[]) if (!firstCardOf.has(r.verse_start!)) firstCardOf.set(r.verse_start!, r);
  const blocks = chapterBlocks(
    reference.verses,
    [...firstCardOf.values()].map((r) => ({ start: r.verse_start!, end: r.verse_end! })),
    { psalm: book === "PSA", titleVerses: book === "PSA" ? TITLE_VERSES[chapter - 1] : 0 },
  );
  const cardsByStart = new Map<number, CardSummary>();
  const carded = blocks.filter((b) => b.carded).map((b) => firstCardOf.get(b.start)!);
  for (const c of await assembleCards(db, carded, language, prefs)) cardsByStart.set(c.verse_start!, c);

  // Verified extracts of the Fathers on this chapter (New Testament only).
  const keys = reference.verses.map((v) => verseKey(book, chapter, v.verse));
  const { data: sources, error: sError } = await db
    .from("sources")
    .select("id, author, work, section, url, region, text, bible_refs")
    .eq("verified", true)
    .eq("kind", "patristic")
    .overlaps("bible_refs", keys)
    .limit(400);
  if (sError) throw new Error(sError.message);

  const plan = versionPlan(language, prefs, book === "PSA");
  return Promise.all(
    blocks.map(async (b) => {
      const range: Range = { book, chapterStart: chapter, verseStart: b.start, chapterEnd: chapter, verseEnd: b.end };
      const ref: PassageText = { ...reference, verses: reference.verses.filter((v) => v.verse >= b.start && v.verse <= b.end) };
      const text = (await textWithFallback(db, plan.neutral, range, ref)) ?? ref;
      const own = new Set(ref.verses.map((v) => verseKey(book, chapter, v.verse)));
      // Extracts that start inside this passage, Eastern and Western Fathers alternated, shortest first.
      const matching = (sources ?? [])
        .filter((s) => s.bible_refs[0] && own.has(s.bible_refs[0]))
        .sort((x, y) => (x.text?.length ?? 0) - (y.text?.length ?? 0));
      const east = matching.filter((s) => s.region === "east");
      const other = matching.filter((s) => s.region !== "east");
      const mixed: typeof matching = [];
      for (let i = 0; mixed.length < EXTRACTS_PER_PASSAGE && (i < east.length || i < other.length); i++) {
        if (east[i]) mixed.push(east[i]!);
        if (other[i] && mixed.length < EXTRACTS_PER_PASSAGE) mixed.push(other[i]!);
      }
      return {
        range,
        reference: formatReference(range, language),
        text,
        card: b.carded ? (cardsByStart.get(b.start) ?? null) : null,
        fathers: mixed.map((s) => ({
          id: s.id,
          author: s.author,
          work: s.work,
          section: s.section,
          url: s.url,
          region: s.region,
          text: (s.text ?? "").length > EXTRACT_CHARS ? `${s.text!.slice(0, EXTRACT_CHARS).replace(/\s+\S*$/, "")}…` : (s.text ?? ""),
        })),
      };
    }),
  );
}
