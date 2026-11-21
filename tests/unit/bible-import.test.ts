import { describe, expect, it } from "vitest";
import { BOOKS, NT_BOOKS, sortKey } from "@/lib/bible/books";
import { KNOWN_VERSES } from "@/lib/bible/known-verses";
import {
  cleanBrentonVerse,
  confirmedRatio,
  normalizeVerseText,
  parseBrentonJson,
  parseCsv,
  parseScrollmapperCsv,
  parseVrefCorpus,
} from "@/lib/bible/parse";
import { encodingProblem, ntReferenceKeys, validateVersion } from "@/lib/bible/validate";
import { VERSIONS } from "@/lib/bible/versions";

describe("books", () => {
  it("has the 27 NT books with 260 chapters, plus the Psalms", () => {
    expect(NT_BOOKS).toHaveLength(27);
    expect(NT_BOOKS.reduce((n, b) => n + b.chapters, 0)).toBe(260);
    expect(BOOKS.at(-1)!.code).toBe("PSA");
    expect(new Set(BOOKS.map((b) => b.code)).size).toBe(BOOKS.length);
  });

  it("orders verses across books", () => {
    expect(sortKey("MAT", 28, 20)).toBeLessThan(sortKey("MRK", 1, 1));
    expect(sortKey("JHN", 3, 16)).toBeLessThan(sortKey("JHN", 3, 17));
  });

  it("has no alias shared by two books", () => {
    const seen = new Map<string, string>();
    for (const b of BOOKS) for (const a of b.aliases) {
      expect(seen.get(a), `${a} in ${b.code} and ${seen.get(a)}`).toBeUndefined();
      seen.set(a, b.code);
    }
  });
});

describe("parsers", () => {
  const vref = "MAT 1:1\nMAT 1:2\nMAT 1:3\nGEN 1:1\nPSA 23:1\nPS2 1:1\n";

  it("reads eBible vref corpora, skipping empty lines, ranges and other books", () => {
    const corpus = "Livre de la généalogie de Jésus-Christ.\n\n<range>\nAu commencement\nL’Éternel  est mon berger.\nJe suis petit.\n";
    const verses = parseVrefCorpus(vref, corpus, new Set(["MAT", "PSA"]));
    expect(verses).toEqual([
      { book: "MAT", chapter: 1, verse: 1, text: "Livre de la généalogie de Jésus-Christ." },
      { book: "PSA", chapter: 23, verse: 1, text: "L’Éternel est mon berger." },
      { book: "PSA", chapter: 151, verse: 1, text: "Je suis petit." },
    ]);
  });

  it("parses quoted CSV fields", () => {
    expect(parseCsv('a,b\n"x, ""y""",z\r\nlast,"multi\nline"')).toEqual([["a", "b"], ['x, "y"', "z"], ["last", "multi\nline"]]);
  });

  it("reads scrollmapper CSV with book names", () => {
    const csv = 'Book,Chapter,Verse,Text\nPsalms,22,1,"A psalm for David. The Lord ruleth me"\nPsalms,22,7,\nI John,4,8,"God is charity."\nGenesis,1,1,x\n';
    expect(parseScrollmapperCsv(csv, new Set(["PSA", "1JN"]))).toEqual([
      { book: "PSA", chapter: 22, verse: 1, text: "A psalm for David. The Lord ruleth me" },
      { book: "1JN", chapter: 4, verse: 8, text: "God is charity." },
    ]);
    expect(() => parseScrollmapperCsv("A,B\n", new Set())).toThrow(/header/);
  });

  it("removes the page footer from Brenton's last verses", () => {
    expect(cleanBrentonVerse("For the Lord knows the way of the righteous. Psalms < 1 > *1:1 Gr. pestilent. Public Domain")).toBe(
      "For the Lord knows the way of the righteous.",
    );
    expect(cleanBrentonVerse("[and green herb for the service of men;]")).toBe("[and green herb for the service of men;]");
    const json = JSON.stringify({ Psalms: { "2": [{ v: 2, t: "b" }, { v: 1, t: "a Psalms < 2 > x" }] } });
    expect(parseBrentonJson(json)).toEqual([
      { book: "PSA", chapter: 2, verse: 1, text: "a" },
      { book: "PSA", chapter: 2, verse: 2, text: "b" },
    ]);
  });

  it("normalizes whitespace and Unicode, nothing else", () => {
    expect(normalizeVerseText("  Car Dieu  a tant aimé\n le monde ")).toBe("Car Dieu a tant aimé le monde");
    expect(normalizeVerseText("é")).toBe("é");
  });

  it("confirms a repackaged text against the licensed copy", () => {
    const verses = [
      { book: "PSA", chapter: 1, verse: 1, text: "Blessed is the man" },
      { book: "PSA", chapter: 1, verse: 2, text: "Invented line" },
    ];
    expect(confirmedRatio(verses, "Blessed is the man, who has not walked")).toBe(0.5);
  });

  it("detects broken encodings", () => {
    expect(encodingProblem("Ã©glise")).toBe(true);
    expect(encodingProblem("â€™")).toBe(true);
    expect(encodingProblem("bad � char")).toBe(true);
    expect(encodingProblem("Église, « guillemets » et Λόγος")).toBe(false);
  });
});

describe("validation", () => {
  const ntKeys = ntReferenceKeys("MAT 1:1\nMAT 1:2\nACT 8:37\nPSA 1:1\n");
  const v = (book: string, chapter: number, verse: number) => ({ book, chapter, verse, text: "texte" });
  const def = { code: "T", scope: "nt" as const, versification: "mt" as const, allowedMissing: ["ACT 8:37"] };

  it("reads only NT keys from vref", () => {
    expect([...ntKeys]).toEqual(["MAT 1:1", "MAT 1:2", "ACT 8:37"]);
  });

  it("fails on a missing verse that is not a documented variant", () => {
    const report = validateVersion(def, [v("MAT", 1, 1)], ntKeys);
    expect(report.errors).toContain("missing NT verse MAT 1:2");
    expect(report.errors.some((e) => e.includes("ACT 8:37"))).toBe(false);
  });

  it("fails on duplicates and unexpected verses", () => {
    const report = validateVersion(def, [v("MAT", 1, 1), v("MAT", 1, 1), v("MAT", 1, 2), v("MAT", 1, 3)], ntKeys);
    expect(report.errors).toContain("duplicate verse MAT 1:1");
    expect(report.errors).toContain("unexpected NT verse MAT 1:3");
  });

  it("flags psalms whose numbering does not match", () => {
    const psalms = { code: "P", scope: "psalms" as const, versification: "mt" as const, allowedMissing: [] };
    const verses = [] as ReturnType<typeof v>[];
    for (let c = 1; c <= 150; c++) for (let n = 1; n <= (c === 1 ? 5 : 1); n++) verses.push(v("PSA", c, n));
    const report = validateVersion(psalms, verses, new Set());
    const ps1 = report.chapters.find((c) => c.chapter === 1)!;
    expect(ps1).toMatchObject({ verse_count: 5, expected_count: 6, aligned: false });
    expect(report.errors).toEqual([]);
  });
});

describe("version registry", () => {
  it("pins every file to a commit and a SHA-256", () => {
    for (const def of VERSIONS) {
      expect(def.file.url).toMatch(/^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[0-9a-f]{40}\//);
      expect(def.file.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(def.license.length).toBeGreaterThan(5);
    }
  });

  it("only uses public domain texts and has a known verse for each version", () => {
    for (const def of VERSIONS) {
      expect(def.license).toMatch(/^Public Domain/);
      expect(KNOWN_VERSES.some((k) => k.version === def.code)).toBe(true);
    }
  });
});
