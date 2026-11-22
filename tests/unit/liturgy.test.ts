import { describe, expect, it } from "vitest";
import { parseCitation } from "@/lib/liturgy/citation";
import { byzantineRows, romanOccasion, romanRows } from "@/lib/liturgy/lectionary";

describe("lectionary citations", () => {
  it("parses simple and partial-verse ranges", () => {
    expect(parseCitation("Matthew 5:1-12a")).toEqual([{ book: "MAT", chapterStart: 5, verseStart: 1, chapterEnd: 5, verseEnd: 12 }]);
    expect(parseCitation("Cf. Psalm 85:8")).toEqual([{ book: "PSA", chapterStart: 85, verseStart: 8, chapterEnd: 85, verseEnd: 8 }]);
  });

  it("parses cross-chapter ranges, comma lists and semicolons", () => {
    expect(parseCitation("Matthew 9:36-10:8")).toEqual([{ book: "MAT", chapterStart: 9, verseStart: 36, chapterEnd: 10, verseEnd: 8 }]);
    expect(parseCitation("Luke 2:20-21, 40-52")).toEqual([
      { book: "LUK", chapterStart: 2, verseStart: 20, chapterEnd: 2, verseEnd: 21 },
      { book: "LUK", chapterStart: 2, verseStart: 40, chapterEnd: 2, verseEnd: 52 },
    ]);
    expect(parseCitation("I Timothy 3:13-16; 4:1-5")).toEqual([
      { book: "1TI", chapterStart: 3, verseStart: 13, chapterEnd: 3, verseEnd: 16 },
      { book: "1TI", chapterStart: 4, verseStart: 1, chapterEnd: 4, verseEnd: 5 },
    ]);
    expect(parseCitation("Psalm 122: 1-2, 3-4")).toHaveLength(2);
    expect(parseCitation("Psalm 42:3,5;43:3,4")).toHaveLength(4);
  });

  it("keeps the first form of alternatives and ignores books outside Logion", () => {
    expect(parseCitation("John 1:1-18|John 1:1-5, 9-14")).toEqual([{ book: "JHN", chapterStart: 1, verseStart: 1, chapterEnd: 1, verseEnd: 18 }]);
    expect(parseCitation("Isaiah 2:1-5")).toBeNull();
    expect(parseCitation("nonsense")).toBeNull();
    expect(parseCitation("Mark 13:31-37: 14:1-2")).toBeNull(); // source typo: rejected rather than guessed
  });
});

describe("Roman lectionary rows", () => {
  it("labels Sundays and feasts from the data key", () => {
    expect(romanOccasion("OrdSunday4")?.fr).toBe("4e dimanche du temps ordinaire");
    expect(romanOccasion("Advent1")?.en).toBe("1st Sunday of Advent");
    expect(romanOccasion("Christmas.day")?.season).toBe("avent-nativite");
    expect(romanOccasion("Unknown")).toBeNull();
  });

  it("builds rows only for NT and Psalm citations", () => {
    const { rows, skipped } = romanRows(
      {
        OrdSunday4: { first_reading: "Zephaniah 2:3; 3:12-13", responsorial_psalm: "Psalm 146:6-7, 8-9", second_reading: "1 Corinthians 1:26-31", gospel_acclamation: "Matthew 5:12a", gospel: "Matthew 5:1-12a" },
        Christmas: { day: { gospel: "John 1:1-18|John 1:1-5, 9-14" } },
        Mystery: { gospel: "John 1:1" },
      },
      "A",
    );
    expect(rows.map((r) => `${r.book} ${r.chapterStart}:${r.verseStart}`)).toEqual(["PSA 146:6", "PSA 146:8", "1CO 1:26", "MAT 5:1", "JHN 1:1"]);
    expect(rows.find((r) => r.book === "MAT")!.description_fr).toBe("Évangile · 4e dimanche du temps ordinaire, année A (lectionnaire romain)");
    expect(skipped).toEqual(["Mystery"]);
  });
});

describe("Byzantine rows", () => {
  it("dates the readings and places them relative to Pascha", () => {
    const rows = byzantineRows(
      { "2026-04-12": ["Sunday, April 12, 2026", [["MG", "Mark 16:1-8"], ["E", "Acts 1:1-8"], ["G", "John 1:1-17"], ["OT", "Genesis 1:1"]]] },
      [2026],
      () => true,
    );
    expect(rows).toHaveLength(3);
    const gospel = rows.find((r) => r.book === "JHN")!;
    expect(gospel.description_fr).toContain("Pascha");
    expect(gospel.description_fr).toContain("12 avril 2026");
    expect(gospel).toMatchObject({ calendar: "revised_julian", season: "paques-pascha", tradition: "orthodox", rite: "byzantine" });
  });
});
