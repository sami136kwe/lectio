/**
 * Psalm numbering.
 *
 * Reference numbering (used by passages): Hebrew psalm numbers, with the
 * superscriptions ("A psalm of David...") counted as verses, as in the Masoretic
 * text and the Louis Segond 1910.
 *
 * - "eng" versions (WEB, KJV) keep the Hebrew psalm numbers but do not number
 *   the superscriptions: their verse = reference verse - TITLE_VERSES[psalm].
 * - "lxx" versions (Brenton, Giguet, Douay-Rheims from the Vulgate) use the
 *   Greek numbering: Hebrew 9+10 = Greek 9, 114+115 = 113, 116 = 114+115,
 *   147 = 146+147, and 11-113 / 117-146 are shifted by one.
 *   Psalm 151 exists only in the Septuagint.
 *
 * MT_VERSE_COUNTS and TITLE_VERSES were derived from the imported LSG and WEB
 * texts and are re-checked against the database by `npm run import:bible`.
 */

export type Versification = "mt" | "eng" | "lxx";

/** Verses per psalm in the reference numbering (index 0 = Psalm 1). */
export const MT_VERSE_COUNTS: readonly number[] = [
  6, 12, 9, 9, 13, 11, 18, 10, 21, 18, 7, 9, 6, 7, 5, 11, 15, 51, 15, 10, 14, 32, 6, 10, 22, 12, 14, 9, 11, 13, 25, 11, 22, 23,
  28, 13, 40, 23, 14, 18, 14, 12, 5, 27, 18, 12, 10, 15, 21, 23, 21, 11, 7, 9, 24, 14, 12, 12, 18, 14, 9, 13, 12, 11, 14, 20, 8,
  36, 37, 6, 24, 20, 28, 23, 11, 13, 21, 72, 13, 20, 17, 8, 19, 13, 14, 17, 7, 19, 53, 17, 16, 16, 5, 23, 11, 13, 12, 9, 9, 5, 8,
  29, 22, 35, 45, 48, 43, 14, 31, 7, 10, 10, 9, 8, 18, 19, 2, 29, 176, 7, 8, 9, 4, 8, 5, 6, 5, 6, 8, 8, 3, 18, 3, 3, 21, 26, 9, 8,
  24, 14, 10, 8, 12, 15, 21, 10, 20, 14, 9, 6,
];

/** Superscription verses per psalm (0, 1 or 2), index 0 = Psalm 1. */
export const TITLE_VERSES: readonly number[] = (
  "001111111001000001111100000001100101011111011111102212111112111110111100001110011011100110010000000001000001000000000000000000000000000000010100000000"
)
  .split("")
  .map(Number);

/** Verses of Psalm 151 (Septuagint only), as numbered by Brenton and Giguet. */
export const PSALM_151_VERSES = 7;

export type PsalmSegment = {
  id: number;
  hebrew_psalm: number;
  hebrew_verse_start: number;
  hebrew_verse_end: number;
  lxx_psalm: number;
  lxx_verse_offset: number;
  note: string | null;
};

function buildSegments(): PsalmSegment[] {
  const out: PsalmSegment[] = [];
  const add = (h: number, start: number, end: number, lxx: number, offset: number, note: string | null = null) =>
    out.push({ id: out.length + 1, hebrew_psalm: h, hebrew_verse_start: start, hebrew_verse_end: end, lxx_psalm: lxx, lxx_verse_offset: offset, note });
  const count = (h: number) => MT_VERSE_COUNTS[h - 1]!;
  for (let h = 1; h <= 150; h++) {
    if (h <= 8 || h >= 148) add(h, 1, count(h), h, 0);
    else if (h === 9) add(9, 1, count(9), 9, 0, "Hébreu 9 et 10 forment le Psaume 9 grec");
    else if (h === 10) add(10, 1, count(10), 9, count(9), "Hébreu 9 et 10 forment le Psaume 9 grec");
    else if (h <= 113) add(h, 1, count(h), h - 1, 0);
    else if (h === 114) add(114, 1, count(114), 113, 0, "Hébreu 114 et 115 forment le Psaume 113 grec");
    else if (h === 115) add(115, 1, count(115), 113, count(114), "Hébreu 114 et 115 forment le Psaume 113 grec");
    else if (h === 116) {
      add(116, 1, 9, 114, 0, "Hébreu 116 est scindé en Psaumes 114 et 115 grecs");
      add(116, 10, count(116), 115, -9, "Hébreu 116 est scindé en Psaumes 114 et 115 grecs");
    } else if (h <= 146) add(h, 1, count(h), h - 1, 0);
    else {
      add(147, 1, 11, 146, 0, "Hébreu 147 est scindé en Psaumes 146 et 147 grecs");
      add(147, 12, count(147), 147, -11, "Hébreu 147 est scindé en Psaumes 146 et 147 grecs");
    }
  }
  return out;
}

export const PSALM_SEGMENTS: readonly PsalmSegment[] = buildSegments();

export type VerseRef = { chapter: number; verse: number };

/** Hebrew (reference) psalm verse -> Greek psalm verse. */
export function hebrewToLxx(psalm: number, verse: number): VerseRef | null {
  const seg = PSALM_SEGMENTS.find((s) => s.hebrew_psalm === psalm && verse >= s.hebrew_verse_start && verse <= s.hebrew_verse_end);
  return seg ? { chapter: seg.lxx_psalm, verse: verse + seg.lxx_verse_offset } : null;
}

/** Greek psalm verse -> Hebrew (reference) psalm verse. Psalm 151 has none. */
export function lxxToHebrew(psalm: number, verse: number): VerseRef | null {
  for (const s of PSALM_SEGMENTS) {
    if (s.lxx_psalm !== psalm) continue;
    const h = verse - s.lxx_verse_offset;
    if (h >= s.hebrew_verse_start && h <= s.hebrew_verse_end) return { chapter: s.hebrew_psalm, verse: h };
  }
  return null;
}

/** Greek psalm number(s) for a Hebrew psalm, e.g. 23 -> "22", 116 -> "114-115". */
export function lxxLabel(hebrewPsalm: number): string {
  const nums = [...new Set(PSALM_SEGMENTS.filter((s) => s.hebrew_psalm === hebrewPsalm).map((s) => s.lxx_psalm))];
  return nums.join("-");
}

/** Hebrew psalm numbers contained in a Greek psalm, e.g. 9 -> [9, 10]. */
export function hebrewPsalmsOf(lxxPsalm: number): number[] {
  return [...new Set(PSALM_SEGMENTS.filter((s) => s.lxx_psalm === lxxPsalm).map((s) => s.hebrew_psalm))];
}

/** Greek psalm numbers covered by a Hebrew verse range (used for passages.psalm_number_lxx). */
export function lxxLabelForRange(hebrewPsalm: number, verseStart: number, verseEnd: number): string {
  const a = hebrewToLxx(hebrewPsalm, verseStart);
  const b = hebrewToLxx(hebrewPsalm, verseEnd);
  if (!a || !b) return lxxLabel(hebrewPsalm);
  return a.chapter === b.chapter ? String(a.chapter) : `${a.chapter}-${b.chapter}`;
}

/** Expected verse count of a Greek psalm, derived from the Hebrew counts. */
export function lxxExpectedCount(lxxPsalm: number): number {
  if (lxxPsalm === 151) return PSALM_151_VERSES;
  let max = 0;
  for (const s of PSALM_SEGMENTS) if (s.lxx_psalm === lxxPsalm) max = Math.max(max, s.hebrew_verse_end + s.lxx_verse_offset);
  return max;
}

/** Expected verse count of a psalm in a version's own numbering. */
export function expectedPsalmCount(versification: Versification, chapter: number): number {
  if (versification === "lxx") return lxxExpectedCount(chapter);
  if (chapter < 1 || chapter > 150) return 0;
  const mt = MT_VERSE_COUNTS[chapter - 1]!;
  return versification === "mt" ? mt : mt - TITLE_VERSES[chapter - 1]!;
}

/**
 * Maps a reference verse (book, chapter, verse) to the numbering of a version.
 * Returns null when the version has no such verse (e.g. a superscription in an
 * "eng" version, or Psalm 151 outside the Septuagint).
 */
export function toVersionRef(versification: Versification, bookCode: string, chapter: number, verse: number): VerseRef | null {
  if (bookCode !== "PSA") return { chapter, verse };
  if (chapter === 151) return versification === "lxx" ? { chapter, verse } : null;
  if (versification === "mt") return { chapter, verse };
  if (versification === "eng") {
    const v = verse - TITLE_VERSES[chapter - 1]!;
    return v >= 1 ? { chapter, verse: v } : null;
  }
  return hebrewToLxx(chapter, verse);
}

/** "Psaume 23 (22 dans la Septante)" / "Psalm 23 (22 in the Septuagint)". */
export function psalmTitle(hebrew: number | null, lxx: string | null, locale: "fr" | "en"): string {
  if (hebrew === null) {
    return locale === "fr" ? `Psaume ${lxx ?? "151"} (Septante uniquement)` : `Psalm ${lxx ?? "151"} (Septuagint only)`;
  }
  const g = lxx ?? lxxLabel(hebrew);
  if (g === String(hebrew)) return locale === "fr" ? `Psaume ${hebrew} (même numéro dans la Septante)` : `Psalm ${hebrew} (same number in the Septuagint)`;
  return locale === "fr" ? `Psaume ${hebrew} (${g} dans la Septante)` : `Psalm ${hebrew} (${g} in the Septuagint)`;
}
