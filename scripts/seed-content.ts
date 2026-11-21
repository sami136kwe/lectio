/**
 * Loads the cards written in content/cards/*.json (same format as the demo
 * cards, see supabase/seed/demo-cards.ts) into the database, offline and free:
 *   npm run seed:content                  every file
 *   npm run seed:content -- --book=MRK    one file
 *
 * Every card goes through the same rule-based checks as generated cards
 * (style, divergence and balance, attributions with verified sources, exact
 * quotes, no verse quoted from memory). A card that fails is skipped and
 * reported; the others are loaded. Idempotent.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { textWithFallback, referenceText } from "@/lib/bible/passage";
import { checkAttributions, checkDivergence, checkQuotedScripture, checkStyle, merge, type CardText } from "@/lib/content/checks";
import type { DemoCard } from "@/supabase/seed/demo-cards";
import { argValue, createServiceClient, type ScriptDb } from "./lib";
import { seedCard } from "./seed-demo";

const DIR = join(process.cwd(), "content", "cards");

async function passagePool(db: ScriptDb, c: DemoCard): Promise<string[]> {
  const r = { book: c.book, chapterStart: c.chapterStart, verseStart: c.verseStart, chapterEnd: c.chapterEnd, verseEnd: c.verseEnd };
  const ref = await referenceText(db, r);
  const texts = [ref];
  for (const code of ["WEB", "KJV", "DRC", "BRENTON_LXX", "GIGUET_LXX"]) {
    const t = await textWithFallback(db, [code], r, ref);
    if (t) texts.push(t);
  }
  return texts.map((t) => t.verses.map((v) => v.text).join(" "));
}

export function checkCard(c: DemoCard, pool: string[]): string[] {
  const reasons: string[] = [];
  for (const language of ["fr", "en"] as const) {
    const t: CardText = { language, explanation: c.explanation[language], catholic: c.catholic[language], orthodox: c.orthodox[language], action: c.action[language], divergence_summary: c.divergence.summary[language] };
    const results = [checkStyle(t), checkDivergence(t, c.divergence.type, c.divergence.topic), checkAttributions(t.explanation, []), checkQuotedScripture(`${t.explanation} ${t.catholic} ${t.orthodox} ${t.action}`, pool)];
    for (const tradition of ["catholic", "orthodox"] as const) {
      const linked = c.sources.filter((s) => s.tradition === tradition).map((s) => ({ author: s.author, work: s.work, text: s.quote ?? null, quote: s.quote ?? null }));
      results.push(checkAttributions(t[tradition], linked));
    }
    reasons.push(...merge(...results).reasons.map((r) => `${language}:${r}`));
  }
  return reasons;
}

async function main() {
  const db = createServiceClient();
  const only = argValue("book")?.toUpperCase();
  const files = readdirSync(DIR).filter((f) => f.endsWith(".json") && (!only || f === `${only}.json`)).sort();
  if (files.length === 0) throw new Error(`no file in content/cards${only ? ` for ${only}` : ""}`);
  const { data: cats, error } = await db.from("categories").select("id, slug");
  if (error) throw new Error(error.message);
  const categories = new Map(cats.map((c) => [c.slug, c.id]));
  let loaded = 0;
  let skipped = 0;
  for (const file of files) {
    const cards = JSON.parse(readFileSync(join(DIR, file), "utf8")) as DemoCard[];
    for (const c of cards) {
      const reasons = checkCard(c, await passagePool(db, c));
      if (reasons.length) {
        skipped += 1;
        console.log(`  ✖ ${c.key}: ${reasons.join(", ")}`);
        continue;
      }
      try {
        await seedCard(db, c, categories, "seed");
        loaded += 1;
      } catch (e) {
        skipped += 1;
        console.log(`  ✖ ${c.key}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    console.log(`${file}: ${cards.length} cards`);
  }
  console.log(`Loaded ${loaded} cards, skipped ${skipped}.`);
  if (skipped) process.exit(1);
}

if (process.argv[1]?.endsWith("seed-content.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
