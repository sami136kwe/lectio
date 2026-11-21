/**
 * Writing aid for content/cards: for each passage still without a card,
 * prints the exact texts (LSG, WEB) and the verified sources that comment on it.
 *   npx tsx scripts/content-brief.ts --book=MRK --from=1 --to=2
 */
import { textWithFallback } from "@/lib/bible/passage";
import { buildContext, planPassages } from "@/lib/pipeline/run";
import { argValue, createServiceClient } from "./lib";

async function main() {
  const db = createServiceClient();
  const book = argValue("book")!.toUpperCase();
  const from = Number(argValue("from") ?? 1);
  const to = Number(argValue("to") ?? from);
  const plan = (await planPassages(db, { kind: "book", book })).filter((p) => p.chapterStart >= from && p.chapterStart <= to);
  for (const p of plan) {
    const ctx = await buildContext(db, p);
    const kjv = await textWithFallback(db, ["KJV"], p);
    console.log(`\n### ${book} ${p.chapterStart}:${p.verseStart}-${p.verseEnd}`);
    console.log(`FR: ${ctx.texts.fr.verses.map((v) => `${v.verse} ${v.text}`).join(" ")}`);
    console.log(`EN: ${ctx.texts.en.verses.map((v) => `${v.verse} ${v.text}`).join(" ")}`);
    if (kjv) console.log(`KJV: ${kjv.verses.map((v) => v.text).join(" ")}`.slice(0, 400));
    for (const s of ctx.sources.slice(0, 4)) console.log(`- [${s.region ?? "-"}] ${s.author} | ${s.work} | ${s.section} | ${s.text.replace(/\s+/g, " ").slice(0, 420)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
