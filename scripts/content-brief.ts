/**
 * Writing aid for content/cards: for each passage still without a card,
 * prints the exact texts (LSG, WEB) and the verified sources that comment on it.
 *   npx tsx scripts/content-brief.ts --book=MRK --from=1 --to=2
 */
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
    console.log(`\n### ${book} ${p.chapterStart}:${p.verseStart}-${p.verseEnd}`);
    console.log(`FR: ${ctx.texts.fr.verses.map((v) => `${v.verse} ${v.text}`).join(" ")}`);
    console.log(`EN: ${ctx.texts.en.verses.map((v) => `${v.verse} ${v.text}`).join(" ")}`);
    const east = ctx.sources.filter((s) => s.region === "east").slice(0, 2);
    const west = ctx.sources.filter((s) => s.region === "west").slice(0, 2);
    const other = ctx.sources.filter((s) => s.region !== "east" && s.region !== "west").slice(0, 3);
    for (const s of [...east, ...west, ...other]) console.log(`- [${s.region}] ${s.author} | ${s.work.replace("Catena Aurea (Thomas Aquinas), Commentary on ", "CA ")} | ${s.section} | ${s.text.replace(/\s+/g, " ").slice(0, Number(process.env.BRIEF_CHARS ?? 260))}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
