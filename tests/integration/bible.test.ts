/**
 * Integrity of the imported Bible text, sources and demo cards (needs `npm run setup`).
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@/types/database";
import { BOOKS, NT_BOOKS } from "@/lib/bible/books";
import { KNOWN_VERSES } from "@/lib/bible/known-verses";
import { passageTextHash, referenceText, textWithFallback, versionText } from "@/lib/bible/passage";
import { MT_VERSE_COUNTS, TITLE_VERSES } from "@/lib/bible/psalms";
import { checkQuotedScripture, checkSourceUse } from "@/lib/content/checks";
import { cardsByIds } from "@/lib/cards";
import { DEMO_CARDS } from "@/supabase/seed/demo-cards";

config({ path: ".env.local" });
const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function versionId(code: string) {
  const { data } = await db.from("bible_versions").select("id, verse_count").eq("code", code).single();
  return data!;
}

async function countsByBook(id: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const b of BOOKS) {
    const { count } = await db.from("bible_verses").select("id", { count: "exact", head: true }).eq("version_id", id).eq("book_code", b.code);
    out.set(b.code, count ?? 0);
  }
  return out;
}

describe("imported Bible text", () => {
  it("has the expected verse counts per book (LSG 1910)", async () => {
    const lsg = await versionId("LSG1910");
    const counts = await countsByBook((lsg as { id: string }).id);
    // Verses per book in the eBible vref numbering (metadata/vref.txt at the pinned commit): 7957 NT verses.
    const expected: Record<string, number> = { MAT: 1071, MRK: 678, LUK: 1151, JHN: 879, ACT: 1006, ROM: 433, "1CO": 437, "2CO": 256, GAL: 149, EPH: 155, PHP: 104, COL: 95, "1TH": 89, "2TH": 47, "1TI": 113, "2TI": 83, TIT: 46, PHM: 25, HEB: 303, JAS: 108, "1PE": 105, "2PE": 61, "1JN": 105, "2JN": 13, "3JN": 15, JUD: 25, REV: 405 };
    for (const b of NT_BOOKS) expect(counts.get(b.code), b.code).toBe(expected[b.code]);
    expect(NT_BOOKS.reduce((n, b) => n + counts.get(b.code)!, 0)).toBe(7957);
    expect(counts.get("PSA")).toBe(MT_VERSE_COUNTS.reduce((a, b) => a + b, 0));
  });

  it("has no gap in any NT chapter of the reference version", async () => {
    const { data } = await db.from("bible_chapter_stats").select("book_code, chapter, aligned, bible_versions!inner(code)").eq("bible_versions.code", "LSG1910");
    expect(data!.length).toBe(260 + 150);
    expect(data!.every((c) => c.aligned)).toBe(true);
  });

  it("matches the known verses", async () => {
    for (const k of KNOWN_VERSES) {
      const [book, cv] = k.ref.split(" ");
      const [chapter, verse] = cv!.split(":").map(Number);
      const { data } = await db.from("bible_verses").select("text, bible_versions!inner(code)").eq("bible_versions.code", k.version).eq("book_code", book!).eq("chapter", chapter!).eq("verse", verse!).single();
      expect(data?.text.startsWith(k.startsWith), `${k.version} ${k.ref}`).toBe(true);
    }
  });

  it("proves the title table: LSG minus WEB verse count per psalm", async () => {
    const [lsg, web] = await Promise.all([versionId("LSG1910"), versionId("WEB")]);
    for (const c of [3, 18, 22, 51, 60, 119, 150]) {
      const count = async (id: string) => (await db.from("bible_verses").select("id", { count: "exact", head: true }).eq("version_id", id).eq("book_code", "PSA").eq("chapter", c)).count ?? 0;
      expect((await count((lsg as { id: string }).id)) - (await count((web as { id: string }).id)), `Psalm ${c}`).toBe(TITLE_VERSES[c - 1]);
    }
  });

  it("maps psalm verses into the Greek numbering and falls back when a chapter is not aligned", async () => {
    const r = { book: "PSA", chapterStart: 22, verseStart: 17, chapterEnd: 22, verseEnd: 17 };
    const brenton = await versionText(db, "BRENTON_LXX", r);
    expect(brenton!.verses[0]).toMatchObject({ chapter: 21, verse: 17 });
    expect(brenton!.verses[0]!.text).toMatch(/pierced my hands and my feet/);
    const web = await versionText(db, "WEB", r);
    expect(web!.verses[0]).toMatchObject({ chapter: 22, verse: 16 });
    // Brenton's Psalm 115 (Hebrew 116:10-19) has a different verse division: never mapped.
    const misaligned = await textWithFallback(db, ["BRENTON_LXX", "DRC"], { book: "PSA", chapterStart: 116, verseStart: 10, chapterEnd: 116, verseEnd: 12 });
    expect(misaligned?.version).toBe("DRC");
    expect(misaligned?.fallbackFrom).toBe("BRENTON_LXX");
  });
});

describe("demo cards", () => {
  it("are all published in both languages with both readings", async () => {
    const { data } = await db.from("cards").select("id, passage_text_hash, card_translations(language, status), card_perspectives(language, tradition)").eq("source_type", "manual");
    expect(data!.length).toBe(DEMO_CARDS.length);
    for (const c of data!) {
      expect(c.card_translations.map((t) => t.language).sort()).toEqual(["en", "fr"]);
      expect(c.card_perspectives.map((p) => `${p.language}:${p.tradition}`).sort()).toEqual(["en:catholic", "en:orthodox", "fr:catholic", "fr:orthodox"]);
    }
  });

  it("show the Bible text exactly as stored, unchanged since writing", async () => {
    const { data } = await db.from("card_details").select("id, book_code, chapter_start, verse_start, chapter_end, verse_end").eq("source_type", "manual").eq("language", "fr");
    const { data: cards } = await db.from("cards").select("id, passage_text_hash").eq("source_type", "manual");
    const hash = new Map(cards!.map((c) => [c.id, c.passage_text_hash]));
    for (const c of data!) {
      const ref = await referenceText(db, { book: c.book_code!, chapterStart: c.chapter_start!, verseStart: c.verse_start!, chapterEnd: c.chapter_end!, verseEnd: c.verse_end! });
      expect(passageTextHash(ref), c.id!).toBe(hash.get(c.id!));
    }
  });

  it("quote no verse from memory, and quote sources word for word", async () => {
    const ids = (await db.from("cards").select("id").eq("source_type", "manual")).data!.map((c) => c.id);
    for (const language of ["fr", "en"] as const) {
      const cards = await cardsByIds(db, ids, language, { bible_version_fr: "LSG1910", bible_version_en: "WEB", show_greek: false });
      expect(cards).toHaveLength(DEMO_CARDS.length);
      for (const card of cards) {
        const texts = [card.passage, card.tradition_texts.catholic, card.tradition_texts.orthodox].filter(Boolean).map((t) => t!.verses.map((v) => v.text).join(" "));
        // Phrases taken from another version of the same passage (KJV/DRC/Brenton in English, LSG in French) are allowed too.
        const others = await Promise.all(["KJV", "DRC", "BRENTON_LXX", "GIGUET_LXX"].map((v) => versionText(db, v, { book: card.book_code!, chapterStart: card.chapter_start!, verseStart: card.verse_start!, chapterEnd: card.chapter_end!, verseEnd: card.verse_end! })));
        const pool = [...texts, ...others.filter(Boolean).map((t) => t!.verses.map((v) => v.text).join(" "))];
        for (const p of card.perspectives) {
          expect(checkQuotedScripture(p.body, pool).reasons, `${card.reference} ${p.tradition}`).toEqual([]);
        }
        expect(checkQuotedScripture(card.plain_explanation!, pool).reasons, card.reference).toEqual([]);
      }
    }
    const { data: links } = await db.from("perspective_sources").select("quote, sources(author, work, text, verified)");
    for (const l of links!) {
      const s = l.sources as unknown as { author: string; work: string; text: string; verified: boolean };
      expect(s.verified).toBe(true);
      expect(checkSourceUse("", [{ ...s, quote: l.quote }]).reasons).toEqual([]);
    }
  });
});
