import { describe, expect, it } from "vitest";
import { chapterBlocks } from "@/lib/reader";
import { validateCoverage } from "@/lib/pipeline/segment";

const verses = Array.from({ length: 20 }, (_, i) => ({ verse: i + 1, text: `Phrase ${i + 1}.` }));

describe("chapter reader blocks", () => {
  it("covers every verse once, keeping card passages as they are", () => {
    const blocks = chapterBlocks(verses, [{ start: 5, end: 9 }]);
    expect(validateCoverage(verses, blocks)).toEqual([]);
    expect(blocks.filter((b) => b.carded)).toEqual([{ start: 5, end: 9, carded: true }]);
    expect(blocks[0]!.start).toBe(1);
    expect(blocks.at(-1)!.end).toBe(20);
  });

  it("cuts a chapter without any card like the generation pipeline", () => {
    const blocks = chapterBlocks(verses, []);
    expect(blocks.every((b) => !b.carded)).toBe(true);
    expect(validateCoverage(verses, blocks)).toEqual([]);
  });

  it("ignores a card that overlaps an earlier one", () => {
    const blocks = chapterBlocks(verses, [{ start: 3, end: 8 }, { start: 6, end: 10 }]);
    expect(blocks.filter((b) => b.carded)).toEqual([{ start: 3, end: 8, carded: true }]);
    expect(validateCoverage(verses, blocks)).toEqual([]);
  });
});
