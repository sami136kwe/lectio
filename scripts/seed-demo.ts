/**
 * Loads the hand-written demonstration cards (supabase/seed/demo-cards.ts).
 * Needs the categories, the Bible text and the sources first:
 *   npm run seed:categories && npm run import:bible && npm run import:sources && npm run seed:demo
 *
 * Idempotent. Fails if a cited source is not a verified source of the
 * database or if a quote is not found word for word in it.
 */
import { createHash } from "node:crypto";
import { passageTextHash, referenceText } from "@/lib/bible/passage";
import { lxxLabelForRange } from "@/lib/bible/psalms";
import { sortKey } from "@/lib/bible/books";
import { DEMO_CARDS, type DemoCard } from "@/supabase/seed/demo-cards";
import { createServiceClient, type ScriptDb } from "./lib";

export async function upsertPassage(db: ScriptDb, c: Pick<DemoCard, "book" | "chapterStart" | "verseStart" | "chapterEnd" | "verseEnd">): Promise<string> {
  const isPsalm = c.book === "PSA";
  const row = {
    book_code: c.book,
    chapter_start: c.chapterStart,
    verse_start: c.verseStart,
    chapter_end: c.chapterEnd,
    verse_end: c.verseEnd,
    psalm_number_hebrew: isPsalm && c.chapterStart <= 150 ? c.chapterStart : null,
    psalm_number_lxx: isPsalm ? (c.chapterStart === 151 ? "151" : lxxLabelForRange(c.chapterStart, c.verseStart, c.verseEnd)) : null,
    sort_key: sortKey(c.book, c.chapterStart, c.verseStart),
  };
  const { data, error } = await db.from("passages").upsert(row, { onConflict: "book_code,chapter_start,verse_start,chapter_end,verse_end" }).select("id").single();
  if (error) throw new Error(`passage: ${error.message}`);
  return data.id;
}

async function sourceId(db: ScriptDb, s: DemoCard["sources"][number], key: string): Promise<string> {
  const { data, error } = await db
    .from("sources")
    .select("id, text")
    .eq("author", s.author)
    .eq("section", s.section)
    .like("work", `${s.work}%`)
    .eq("verified", true)
    .contains("bible_refs", [s.ref]);
  if (error) throw new Error(error.message);
  const match = s.quote ? data.find((d) => d.text?.includes(s.quote!)) : data[0];
  if (!match) throw new Error(`${key}: no verified source ${s.author}, ${s.work}, ${s.section} for ${s.ref}${s.quote ? " containing the quote" : ""}`);
  return match.id;
}

/** Seasons of a passage, from the liturgical uses that cover it. */
export async function seasonsFor(db: ScriptDb, c: Pick<DemoCard, "book" | "chapterStart" | "verseStart" | "chapterEnd" | "verseEnd">): Promise<string[]> {
  const { data, error } = await db
    .from("liturgical_uses")
    .select("season_id, chapter_start, verse_start, chapter_end, verse_end")
    .eq("book_code", c.book)
    .lte("chapter_start", c.chapterEnd)
    .gte("chapter_end", c.chapterStart)
    .not("season_id", "is", null);
  if (error) throw new Error(error.message);
  const start = c.chapterStart * 1000 + c.verseStart;
  const end = c.chapterEnd * 1000 + c.verseEnd;
  return [...new Set(data.filter((u) => u.chapter_start * 1000 + u.verse_start <= end && u.chapter_end * 1000 + u.verse_end >= start).map((u) => u.season_id!))];
}

async function seedCard(db: ScriptDb, c: DemoCard, categories: Map<string, string>) {
  const categoryId = categories.get(c.category);
  if (!categoryId) throw new Error(`${c.key}: unknown category ${c.category}`);
  const passageId = await upsertPassage(db, c);
  const reference = await referenceText(db, { book: c.book, chapterStart: c.chapterStart, verseStart: c.verseStart, chapterEnd: c.chapterEnd, verseEnd: c.verseEnd });
  const expected = (c.chapterEnd - c.chapterStart) * 1000 + c.verseEnd - c.verseStart + 1;
  if (c.chapterEnd === c.chapterStart && reference.verses.length !== expected) throw new Error(`${c.key}: ${reference.verses.length} verses found, ${expected} expected`);

  const { data: card, error } = await db
    .from("cards")
    .upsert(
      {
        passage_id: passageId,
        category_id: categoryId,
        difficulty: c.difficulty,
        status: "published",
        quality_score: 9,
        content_hash: createHash("sha256").update(`manual:${c.key}`).digest("hex"),
        passage_text_hash: passageTextHash(reference),
        source_type: "manual",
      },
      { onConflict: "content_hash" },
    )
    .select("id")
    .single();
  if (error) throw new Error(`${c.key}: ${error.message}`);

  for (const table of ["card_translations", "card_perspectives", "card_seasons"] as const) {
    const { error: delError } = await db.from(table).delete().eq("card_id", card.id);
    if (delError) throw new Error(`${c.key} ${table}: ${delError.message}`);
  }
  const { error: tError } = await db.from("card_translations").insert(
    (["fr", "en"] as const).map((language) => ({
      card_id: card.id,
      language,
      plain_explanation: c.explanation[language],
      action_step: c.action[language],
      status: "published",
    })),
  );
  if (tError) throw new Error(`${c.key} translations: ${tError.message}`);

  for (const tradition of ["catholic", "orthodox"] as const) {
    for (const language of ["fr", "en"] as const) {
      const { data: p, error: pError } = await db
        .from("card_perspectives")
        .insert({
          card_id: card.id,
          language,
          tradition,
          body: c[tradition][language],
          divergence_type: c.divergence.type,
          divergence_topic: c.divergence.topic ?? null,
          divergence_summary: c.divergence.summary[language],
          review_status: "unreviewed",
        })
        .select("id")
        .single();
      if (pError) throw new Error(`${c.key} ${tradition}: ${pError.message}`);
      for (const s of c.sources.filter((x) => x.tradition === tradition)) {
        const { error: lError } = await db
          .from("perspective_sources")
          .insert({ perspective_id: p.id, source_id: await sourceId(db, s, c.key), usage: s.usage, quote: s.quote ?? null });
        if (lError) throw new Error(`${c.key} source: ${lError.message}`);
      }
    }
  }
  const seasons = await seasonsFor(db, c);
  if (seasons.length) {
    const { error: sError } = await db.from("card_seasons").insert(seasons.map((season_id) => ({ card_id: card.id, season_id })));
    if (sError) throw new Error(`${c.key} seasons: ${sError.message}`);
  }
}

async function main() {
  const db = createServiceClient();
  const { data: cats, error } = await db.from("categories").select("id, slug");
  if (error) throw new Error(error.message);
  if (cats.length === 0) throw new Error("run `npm run seed:categories` first");
  const categories = new Map(cats.map((c) => [c.slug, c.id]));
  for (const c of DEMO_CARDS) {
    await seedCard(db, c, categories);
    console.log(`  ✔ ${c.key}`);
  }
  console.log(`Demo cards: ${DEMO_CARDS.length} (both languages, Catholic and Orthodox readings, unreviewed).`);
}

if (process.argv[1]?.endsWith("seed-demo.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
