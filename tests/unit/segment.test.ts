import { describe, expect, it } from "vitest";
import { endsSentence, MAX_VERSES, segmentChapter, validateCoverage } from "@/lib/pipeline/segment";

const chapter = (texts: string[]) => texts.map((text, i) => ({ verse: i + 1, text }));

describe("passage segmentation", () => {
  it("recognises sentence ends, including closing quotes", () => {
    expect(endsSentence("Il dit: Suis-moi.")).toBe(true);
    expect(endsSentence("Pourquoi?")).toBe(true);
    expect(endsSentence("« Heureux les pauvres. »")).toBe(true);
    expect(endsSentence("Et il leur dit,")).toBe(false);
  });

  it("covers a long chapter exactly once with passages of at most 8 verses, cut at sentence ends", () => {
    const texts = Array.from({ length: 31 }, (_, i) => (i % 3 === 2 ? `Phrase ${i}.` : `Suite ${i},`));
    const verses = chapter(texts);
    const segs = segmentChapter(verses);
    expect(validateCoverage(verses, segs)).toEqual([]);
    for (const s of segs.slice(0, -1)) expect(texts[s.end - 1]!.endsWith(".")).toBe(true);
    for (const s of segs) expect(s.end - s.start + 1).toBeLessThanOrEqual(MAX_VERSES);
  });

  it("forces a cut at 8 verses when no sentence ends", () => {
    const verses = chapter(Array.from({ length: 20 }, (_, i) => `sans fin ${i},`));
    const segs = segmentChapter(verses);
    expect(validateCoverage(verses, segs)).toEqual([]);
    expect(segs[0]).toEqual({ start: 1, end: 8 });
  });

  it("keeps a short psalm whole and cuts longer psalms at 'Pause'", () => {
    expect(segmentChapter(chapter(["Titre.", "a.", "b.", "c.", "d.", "e."]), { psalm: true })).toEqual([{ start: 1, end: 6 }]);
    const ps = chapter(["Psaume de David.", "a,", "b,", "c,", "d. — Pause.", "e.", "f.", "g.", "h.", "i.", "j.", "k."]);
    const segs = segmentChapter(ps, { psalm: true, titleVerses: 1 });
    expect(segs[0]).toEqual({ start: 1, end: 5 });
    expect(validateCoverage(ps, segs)).toEqual([]);
  });

  it("produces different cuts with an offset (for --extend)", () => {
    const verses = chapter(Array.from({ length: 24 }, (_, i) => `Phrase ${i}.`));
    const a = segmentChapter(verses);
    const b = segmentChapter(verses, { offset: 2 });
    expect(validateCoverage(verses, b)).toEqual([]);
    expect(b).not.toEqual(a);
  });

  it("reports gaps and duplicates", () => {
    const verses = chapter(["a.", "b.", "c."]);
    expect(validateCoverage(verses, [{ start: 1, end: 1 }, { start: 3, end: 3 }])).not.toEqual([]);
    expect(validateCoverage(verses, [{ start: 1, end: 2 }, { start: 2, end: 3 }])).not.toEqual([]);
  });
});
