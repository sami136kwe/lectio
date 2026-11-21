import { describe, expect, it } from "vitest";
import {
  MT_VERSE_COUNTS,
  PSALM_SEGMENTS,
  TITLE_VERSES,
  expectedPsalmCount,
  hebrewPsalmsOf,
  hebrewToLxx,
  lxxExpectedCount,
  lxxLabel,
  lxxLabelForRange,
  lxxToHebrew,
  psalmTitle,
  toVersionRef,
} from "@/lib/bible/psalms";

describe("psalm numbering table", () => {
  it("covers every verse of the 150 Hebrew psalms exactly once, without gaps", () => {
    expect(MT_VERSE_COUNTS).toHaveLength(150);
    for (let h = 1; h <= 150; h++) {
      const segs = PSALM_SEGMENTS.filter((s) => s.hebrew_psalm === h).sort((a, b) => a.hebrew_verse_start - b.hebrew_verse_start);
      expect(segs.length).toBeGreaterThan(0);
      expect(segs[0]!.hebrew_verse_start).toBe(1);
      expect(segs.at(-1)!.hebrew_verse_end).toBe(MT_VERSE_COUNTS[h - 1]);
      for (let i = 1; i < segs.length; i++) expect(segs[i]!.hebrew_verse_start).toBe(segs[i - 1]!.hebrew_verse_end + 1);
    }
  });

  it("maps onto Greek psalms 1-150 with contiguous verses, each Greek verse used once", () => {
    for (let l = 1; l <= 150; l++) {
      const used: number[] = [];
      for (const s of PSALM_SEGMENTS.filter((x) => x.lxx_psalm === l)) {
        for (let v = s.hebrew_verse_start; v <= s.hebrew_verse_end; v++) used.push(v + s.lxx_verse_offset);
      }
      used.sort((a, b) => a - b);
      expect(used.length, `Greek psalm ${l}`).toBeGreaterThan(0);
      used.forEach((v, i) => expect(v).toBe(i + 1));
      expect(lxxExpectedCount(l)).toBe(used.length);
    }
  });

  it("knows the merged and split psalms", () => {
    expect(hebrewPsalmsOf(9)).toEqual([9, 10]);
    expect(hebrewPsalmsOf(113)).toEqual([114, 115]);
    expect(lxxLabel(116)).toBe("114-115");
    expect(lxxLabel(147)).toBe("146-147");
    expect(hebrewToLxx(10, 1)).toEqual({ chapter: 9, verse: 22 });
    expect(hebrewToLxx(115, 1)).toEqual({ chapter: 113, verse: 9 });
    expect(hebrewToLxx(116, 10)).toEqual({ chapter: 115, verse: 1 });
    expect(hebrewToLxx(147, 12)).toEqual({ chapter: 147, verse: 1 });
    expect(hebrewToLxx(147, 11)).toEqual({ chapter: 146, verse: 11 });
  });

  it("shifts 11-113 and 117-146 by one, keeps 1-8 and 148-150", () => {
    expect(lxxLabel(23)).toBe("22");
    expect(lxxLabel(51)).toBe("50");
    expect(lxxLabel(119)).toBe("118");
    expect(lxxLabel(146)).toBe("145");
    expect(lxxLabel(1)).toBe("1");
    expect(lxxLabel(150)).toBe("150");
  });

  it("round-trips every Hebrew verse through the Greek numbering", () => {
    for (let h = 1; h <= 150; h++) {
      for (let v = 1; v <= MT_VERSE_COUNTS[h - 1]!; v++) {
        const g = hebrewToLxx(h, v)!;
        expect(lxxToHebrew(g.chapter, g.verse)).toEqual({ chapter: h, verse: v });
      }
    }
    expect(lxxToHebrew(151, 1)).toBeNull();
  });

  it("labels ranges that straddle a split", () => {
    expect(lxxLabelForRange(116, 1, 9)).toBe("114");
    expect(lxxLabelForRange(116, 8, 12)).toBe("114-115");
    expect(lxxLabelForRange(22, 1, 6)).toBe("21");
  });
});

describe("titles and versions", () => {
  it("has 0, 1 or 2 title verses, with two-verse titles exactly in 51, 52, 54, 60", () => {
    expect(TITLE_VERSES).toHaveLength(150);
    expect(TITLE_VERSES.every((t) => t === 0 || t === 1 || t === 2)).toBe(true);
    const two = TITLE_VERSES.map((t, i) => (t === 2 ? i + 1 : 0)).filter(Boolean);
    expect(two).toEqual([51, 52, 54, 60]);
    expect(TITLE_VERSES[0]).toBe(0); // Psalm 1 has no title
    expect(TITLE_VERSES[2]).toBe(1); // Psalm 3: "Psaume de David. À l'occasion de sa fuite..."
  });

  it("maps reference verses into each numbering", () => {
    expect(toVersionRef("mt", "PSA", 51, 3)).toEqual({ chapter: 51, verse: 3 });
    expect(toVersionRef("eng", "PSA", 51, 3)).toEqual({ chapter: 51, verse: 1 });
    expect(toVersionRef("eng", "PSA", 51, 1)).toBeNull();
    expect(toVersionRef("lxx", "PSA", 51, 3)).toEqual({ chapter: 50, verse: 3 });
    expect(toVersionRef("lxx", "PSA", 22, 17)).toEqual({ chapter: 21, verse: 17 });
    expect(toVersionRef("mt", "PSA", 151, 1)).toBeNull();
    expect(toVersionRef("lxx", "PSA", 151, 1)).toEqual({ chapter: 151, verse: 1 });
    expect(toVersionRef("eng", "JHN", 3, 16)).toEqual({ chapter: 3, verse: 16 });
  });

  it("computes expected counts per numbering", () => {
    expect(expectedPsalmCount("mt", 51)).toBe(21);
    expect(expectedPsalmCount("eng", 51)).toBe(19);
    expect(expectedPsalmCount("lxx", 9)).toBe(39);
    expect(expectedPsalmCount("lxx", 151)).toBe(7);
  });

  it("writes both numberings in titles", () => {
    expect(psalmTitle(23, "22", "fr")).toBe("Psaume 23 (22 dans la Septante)");
    expect(psalmTitle(23, "22", "en")).toBe("Psalm 23 (22 in the Septuagint)");
    expect(psalmTitle(1, "1", "fr")).toBe("Psaume 1 (même numéro dans la Septante)");
    expect(psalmTitle(null, "151", "fr")).toBe("Psaume 151 (Septante uniquement)");
  });
});
