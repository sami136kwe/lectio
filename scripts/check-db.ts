/**
 * Health report of the content database:
 *   npm run check:db            report, exit 1 if a blocking problem is found
 *
 * Checks: number of cards; every NT chapter and every psalm covered by a
 * published card; both languages and both readings on every published card;
 * no attribution without a verified source; quotes word for word; average
 * theology and style scores; review status; Bible text unchanged since each
 * card was written.
 */
import { NT_BOOKS } from "@/lib/bible/books";
import { passageTextHash, referenceText } from "@/lib/bible/passage";
import { checkAttributions, checkSourceUse } from "@/lib/content/checks";
import { createServiceClient } from "./lib";

type Problem = { level: "error" | "warning"; message: string };

async function all<T>(fetch: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await fetch(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) return out;
  }
}

async function main() {
  const db = createServiceClient();
  const problems: Problem[] = [];
  const cards = await all<{ id: string; status: string; theology_score: number | null; passage_text_hash: string; source_type: string; passages: { book_code: string; chapter_start: number; verse_start: number; chapter_end: number; verse_end: number } }>((a, b) =>
    db.from("cards").select("id, status, theology_score, passage_text_hash, source_type, passages!inner(book_code, chapter_start, verse_start, chapter_end, verse_end)").range(a, b) as never,
  );
  const published = cards.filter((c) => c.status === "published");
  const translations = await all<{ card_id: string; language: string; status: string; style_score: number | null }>((a, b) => db.from("card_translations").select("card_id, language, status, style_score").range(a, b));
  const perspectives = await all<{ id: string; card_id: string; language: string; tradition: string; body: string; review_status: string }>((a, b) =>
    db.from("card_perspectives").select("id, card_id, language, tradition, body, review_status").range(a, b),
  );
  const links = await all<{ perspective_id: string; quote: string | null; sources: { author: string; work: string; text: string | null; verified: boolean } }>((a, b) =>
    db.from("perspective_sources").select("perspective_id, quote, sources(author, work, text, verified)").range(a, b) as never,
  );

  console.log(`Cards: ${cards.length} (${published.length} published, ${cards.filter((c) => c.status === "draft").length} drafts, ${cards.filter((c) => c.status === "rejected").length} rejected)`);

  // Coverage
  const covered = new Set(published.map((c) => `${c.passages.book_code} ${c.passages.chapter_start}`));
  const missingNt = NT_BOOKS.flatMap((b) => Array.from({ length: b.chapters }, (_, i) => `${b.code} ${i + 1}`)).filter((k) => !covered.has(k));
  const missingPs = Array.from({ length: 150 }, (_, i) => `PSA ${i + 1}`).filter((k) => !covered.has(k));
  console.log(`Coverage: NT ${260 - missingNt.length}/260 chapters, Psalms ${150 - missingPs.length}/150`);
  if (missingNt.length) problems.push({ level: "warning", message: `${missingNt.length} NT chapters without a published card (e.g. ${missingNt.slice(0, 6).join(", ")})` });
  if (missingPs.length) problems.push({ level: "warning", message: `${missingPs.length} psalms without a published card (e.g. ${missingPs.slice(0, 6).join(", ")})` });

  // Completeness of published cards
  const tByCard = new Map<string, string[]>();
  for (const t of translations) if (t.status === "published") tByCard.set(t.card_id, [...(tByCard.get(t.card_id) ?? []), t.language]);
  const pByCard = new Map<string, string[]>();
  for (const p of perspectives) if (p.review_status !== "rejected") pByCard.set(p.card_id, [...(pByCard.get(p.card_id) ?? []), `${p.language}:${p.tradition}`]);
  const incomplete = published.filter((c) => (tByCard.get(c.id) ?? []).length !== 2 || ["fr:catholic", "fr:orthodox", "en:catholic", "en:orthodox"].some((k) => !(pByCard.get(c.id) ?? []).includes(k)));
  if (incomplete.length) problems.push({ level: "error", message: `${incomplete.length} published cards miss a language or a reading (e.g. ${incomplete.slice(0, 3).map((c) => c.id).join(", ")})` });

  // Attributions and quotes
  const linksByPerspective = new Map<string, typeof links>();
  for (const l of links) linksByPerspective.set(l.perspective_id, [...(linksByPerspective.get(l.perspective_id) ?? []), l]);
  let badAttribution = 0;
  let badQuote = 0;
  let unverified = 0;
  const publishedIds = new Set(published.map((c) => c.id));
  for (const p of perspectives.filter((x) => publishedIds.has(x.card_id) && x.review_status !== "rejected")) {
    const ls = linksByPerspective.get(p.id) ?? [];
    unverified += ls.filter((l) => !l.sources.verified).length;
    const linked = ls.filter((l) => l.sources.verified).map((l) => ({ author: l.sources.author, work: l.sources.work, text: l.sources.text, quote: l.quote }));
    if (!checkAttributions(p.body, linked).ok) badAttribution += 1;
    if (checkSourceUse(p.body, linked).reasons.some((r) => r.startsWith("quote_"))) badQuote += 1;
  }
  if (badAttribution) problems.push({ level: "error", message: `${badAttribution} readings name an author or document without a verified source` });
  if (badQuote) problems.push({ level: "error", message: `${badQuote} readings quote a source inexactly or too long` });
  if (unverified) problems.push({ level: "error", message: `${unverified} links to sources that are no longer verified` });

  // Scores and reviews
  const avg = (xs: number[]) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : "-");
  console.log(`Average theology_score: ${avg(published.flatMap((c) => (c.theology_score === null ? [] : [Number(c.theology_score)])))} · style_score: ${avg(translations.flatMap((t) => (t.style_score === null ? [] : [Number(t.style_score)])))}`);
  const reviews = new Map<string, number>();
  for (const p of perspectives) reviews.set(p.review_status, (reviews.get(p.review_status) ?? 0) + 1);
  console.log(`Readings by review status: ${[...reviews.entries()].map(([k, v]) => `${k} ${v}`).join(", ") || "none"}`);

  // Bible text unchanged since writing
  let drift = 0;
  for (const c of published) {
    const p = c.passages;
    const ref = await referenceText(db, { book: p.book_code, chapterStart: p.chapter_start, verseStart: p.verse_start, chapterEnd: p.chapter_end, verseEnd: p.verse_end });
    if (passageTextHash(ref) !== c.passage_text_hash) drift += 1;
  }
  if (drift) problems.push({ level: "error", message: `${drift} cards whose Bible text no longer matches the database` });
  console.log(`Bible text identical to the database: ${published.length - drift}/${published.length}`);

  if (problems.length === 0) console.log("\n✔ No problem found.");
  for (const p of problems) console.log(`${p.level === "error" ? "✖" : "·"} ${p.message}`);
  if (problems.some((p) => p.level === "error")) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
