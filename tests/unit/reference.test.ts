import { describe, expect, it } from "vitest";
import { formatReference, parseReference } from "@/lib/bible/reference";

const ref = (book: string, chapterStart: number, verseStart: number | null, chapterEnd = chapterStart, verseEnd = verseStart, typedLxx = false) => ({
  book,
  chapterStart,
  verseStart,
  chapterEnd,
  verseEnd,
  typedLxx,
});

describe("parseReference", () => {
  it("reads French and English forms of the same reference", () => {
    expect(parseReference("Jn 3,16")).toEqual(ref("JHN", 3, 16));
    expect(parseReference("Jean 3:16")).toEqual(ref("JHN", 3, 16));
    expect(parseReference("John 3.16")).toEqual(ref("JHN", 3, 16));
    expect(parseReference("  jn   3 , 16 ")).toEqual(ref("JHN", 3, 16));
  });

  it("reads verse ranges and cross-chapter ranges", () => {
    expect(parseReference("Rm 8, 28-30")).toEqual(ref("ROM", 8, 28, 8, 30));
    expect(parseReference("Romains 8:28–30")).toEqual(ref("ROM", 8, 28, 8, 30));
    expect(parseReference("Mt 26,36-27,2")).toEqual(ref("MAT", 26, 36, 27, 2));
  });

  it("reads numbered books and whole chapters", () => {
    expect(parseReference("1 Co 13")).toEqual(ref("1CO", 13, null));
    expect(parseReference("1Cor 13:4-7")).toEqual(ref("1CO", 13, 4, 13, 7));
    expect(parseReference("2 Pierre 1, 4")).toEqual(ref("2PE", 1, 4));
    expect(parseReference("Apocalypse 21")).toEqual(ref("REV", 21, null));
    expect(parseReference("Actes des Apôtres 2, 1")).toEqual(ref("ACT", 2, 1));
  });

  it("reads psalms in the Hebrew numbering by default", () => {
    expect(parseReference("Ps 22")).toEqual(ref("PSA", 22, null));
    expect(parseReference("Psaume 23, 1-4")).toEqual(ref("PSA", 23, 1, 23, 4));
    expect(parseReference("Psalm 51:3")).toEqual(ref("PSA", 51, 3));
  });

  it("converts Greek (Septuagint) psalm numbers to the Hebrew numbering", () => {
    expect(parseReference("Psaume 21 (LXX)")).toEqual(ref("PSA", 22, null, 22, null, true));
    expect(parseReference("Ps 50 LXX, 3")).toEqual(ref("PSA", 51, 3, 51, 3, true));
    expect(parseReference("Ps 50, 3 (LXX)")).toEqual(ref("PSA", 51, 3, 51, 3, true));
    expect(parseReference("Ps 9, 22 (Septante)")).toEqual(ref("PSA", 10, 1, 10, 1, true));
    expect(parseReference("Ps 113 grec")).toEqual(ref("PSA", 114, null, 114, null, true));
    expect(parseReference("Ps 151 (LXX)")).toEqual(ref("PSA", 151, null, 151, null, true));
  });

  it("rejects what is not a reference", () => {
    expect(parseReference("amour")).toBeNull();
    expect(parseReference("Jn 22")).toBeNull(); // John has 21 chapters
    expect(parseReference("Ps 151")).toBeNull(); // only in the Septuagint numbering
    expect(parseReference("Gn 1,1")).toBeNull(); // outside Logion
    expect(parseReference("Jn 3,18-16")).toBeNull();
  });
});

describe("formatReference", () => {
  it("formats in French and English", () => {
    const r = { book: "JHN", chapterStart: 3, verseStart: 16, chapterEnd: 3, verseEnd: 18 };
    expect(formatReference(r, "fr")).toBe("Jean 3, 16-18");
    expect(formatReference(r, "en")).toBe("John 3:16-18");
    expect(formatReference({ ...r, verseEnd: 16 }, "fr", { abbreviated: true })).toBe("Jn 3, 16");
    expect(formatReference({ book: "MAT", chapterStart: 26, verseStart: 36, chapterEnd: 27, verseEnd: 2 }, "en")).toBe("Matthew 26:36 – 27:2");
    expect(formatReference({ book: "PSA", chapterStart: 23, verseStart: 1, chapterEnd: 23, verseEnd: 6 }, "fr")).toBe("Psaume 23, 1-6");
  });
});
