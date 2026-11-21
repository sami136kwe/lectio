/**
 * Export of the cards and their readings, for backup and external review:
 *   npm run export:cards                       -> exports/lectio-cards-<date>.json and .csv
 *   npm run export:cards -- --status=published
 *   npm run export:cards -- --review           -> also the theological review queue as CSV (re-import: npm run review:import)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { toCsv } from "@/lib/admin/review-csv";
import { formatReference } from "@/lib/bible/reference";
import { argValue, createServiceClient, hasFlag } from "./lib";

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

async function main() {
  const db = createServiceClient();
  const status = argValue("status");
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 500) {
    let q = db
      .from("cards")
      .select(
        "id, status, difficulty, theology_score, source_type, created_at, categories(slug), passages(book_code, chapter_start, verse_start, chapter_end, verse_end, psalm_number_hebrew, psalm_number_lxx), card_translations(language, plain_explanation, action_step, status), card_perspectives(id, language, tradition, body, divergence_type, divergence_topic, divergence_summary, review_status, reviewer_note, perspective_sources(usage, quote, sources(author, work, section, url)))",
      )
      .order("created_at")
      .range(from, from + 499);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    out.push(...(data as Record<string, unknown>[]));
    if (data.length < 500) break;
  }
  const dir = join(process.cwd(), "exports");
  mkdirSync(dir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  writeFileSync(join(dir, `lectio-cards-${date}.json`), JSON.stringify(out, null, 2));

  const header = ["card_id", "reference", "status", "category", "language", "explanation", "catholic", "orthodox", "divergence", "divergence_topic", "action", "catholic_review", "orthodox_review"];
  const rows = [header.join(",")];
  for (const c of out as {
    id: string;
    status: string;
    categories: { slug: string };
    passages: { book_code: string; chapter_start: number; verse_start: number; chapter_end: number; verse_end: number };
    card_translations: { language: string; plain_explanation: string; action_step: string }[];
    card_perspectives: { language: string; tradition: string; body: string; divergence_type: string; divergence_topic: string | null; review_status: string }[];
  }[]) {
    for (const t of c.card_translations) {
      const p = (tr: string) => c.card_perspectives.find((x) => x.language === t.language && x.tradition === tr);
      const ref = formatReference({ book: c.passages.book_code, chapterStart: c.passages.chapter_start, verseStart: c.passages.verse_start, chapterEnd: c.passages.chapter_end, verseEnd: c.passages.verse_end }, t.language === "en" ? "en" : "fr");
      rows.push(
        [c.id, ref, c.status, c.categories.slug, t.language, t.plain_explanation, p("catholic")?.body, p("orthodox")?.body, p("catholic")?.divergence_type, p("catholic")?.divergence_topic, t.action_step, p("catholic")?.review_status, p("orthodox")?.review_status]
          .map(csvCell)
          .join(","),
      );
    }
  }
  writeFileSync(join(dir, `lectio-cards-${date}.csv`), `﻿${rows.join("\r\n")}\r\n`);
  console.log(`Exported ${out.length} cards to exports/lectio-cards-${date}.json and .csv`);

  if (hasFlag("review")) {
    const items = (out as { id: string; passages: { book_code: string; chapter_start: number; verse_start: number; chapter_end: number; verse_end: number }; card_perspectives: { id: string; language: string; tradition: string; body: string; divergence_type: string; divergence_topic: string | null; review_status: string; reviewer_note: string | null; perspective_sources: { usage: string; sources: { author: string; work: string; section: string } }[] }[] }[]).flatMap((c) =>
      c.card_perspectives
        .filter((p) => p.tradition !== "common")
        .map((p) => ({
          perspective_id: p.id,
          card_id: c.id,
          reference: formatReference({ book: c.passages.book_code, chapterStart: c.passages.chapter_start, verseStart: c.passages.verse_start, chapterEnd: c.passages.chapter_end, verseEnd: c.passages.verse_end }, p.language === "en" ? "en" : "fr"),
          language: p.language,
          tradition: p.tradition,
          review_status: p.review_status,
          divergence_type: p.divergence_type,
          divergence_topic: p.divergence_topic ?? "",
          body: p.body,
          sources: p.perspective_sources.map((s) => `${s.sources.author}, ${s.sources.work}, ${s.sources.section} (${s.usage})`).join(" | "),
          reviewer_note: p.reviewer_note ?? "",
        })),
    );
    writeFileSync(join(dir, `lectio-review-${date}.csv`), `﻿${toCsv(items)}`);
    console.log(`Review queue: ${items.length} readings in exports/lectio-review-${date}.csv`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
