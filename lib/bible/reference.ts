/**
 * Bible references: parsing what people type ("Jn 3,16", "Jean 3:16",
 * "Rm 8, 28-30", "Ps 22", "Psaume 21 (LXX)") and formatting them back in
 * French or English. Psalms are returned in the reference (Hebrew) numbering,
 * whatever numbering was typed.
 */
import { BOOKS, book } from "./books";
import { hebrewPsalmsOf, lxxToHebrew } from "./psalms";

export type ParsedReference = {
  book: string;
  chapterStart: number;
  /** null = whole chapter */
  verseStart: number | null;
  chapterEnd: number;
  verseEnd: number | null;
  /** The psalm number was typed in the Greek (Septuagint / Vulgate) numbering. */
  typedLxx: boolean;
};

export type Range = { book: string; chapterStart: number; verseStart: number; chapterEnd: number; verseEnd: number };

const ALIASES = new Map<string, string>();
for (const b of BOOKS) for (const a of b.aliases) ALIASES.set(a, b.code);

function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const LXX_MARK = /\(?\s*\b(lxx|septante|septuagint|grec|greek|vulgate)\b\s*\)?/;
const REF = /^([1-3]?\s*[a-z]+(?:\s+[a-z]+)*)\.?\s*(\d{1,3})(?:\s*[,:.]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3})(?:\s*[,:.]\s*(\d{1,3}))?)?)?\s*$/;

export function parseReference(input: string): ParsedReference | null {
  let s = fold(input).trim().replace(/\s+/g, " ");
  if (!s || s.length > 60) return null;
  const typedLxx = LXX_MARK.test(s);
  s = s.replace(LXX_MARK, " ").replace(/\s+/g, " ").trim();
  const m = REF.exec(s);
  if (!m) return null;
  const code = ALIASES.get(m[1]!.replace(/[\s.]/g, ""));
  if (!code) return null;
  let chapterStart = Number(m[2]);
  let verseStart = m[3] ? Number(m[3]) : null;
  let chapterEnd = chapterStart;
  let verseEnd = verseStart;
  if (m[4] && m[5]) {
    chapterEnd = Number(m[4]);
    verseEnd = Number(m[5]);
  } else if (m[4]) {
    verseEnd = Number(m[4]);
  }

  if (code === "PSA" && typedLxx) {
    if (chapterStart === 151) return valid({ book: code, chapterStart, verseStart, chapterEnd: 151, verseEnd, typedLxx });
    if (chapterEnd !== chapterStart) return null;
    if (verseStart === null) {
      const h = hebrewPsalmsOf(chapterStart);
      if (h.length === 0) return null;
      // Greek 9 = Hebrew 9-10, 113 = 114-115: open the first one.
      chapterStart = chapterEnd = h[0]!;
    } else {
      const a = lxxToHebrew(chapterStart, verseStart);
      const b = lxxToHebrew(chapterStart, verseEnd ?? verseStart);
      if (!a || !b) return null;
      chapterStart = a.chapter;
      verseStart = a.verse;
      chapterEnd = b.chapter;
      verseEnd = b.verse;
    }
  }
  return valid({ book: code, chapterStart, verseStart, chapterEnd, verseEnd, typedLxx });
}

function valid(ref: ParsedReference): ParsedReference | null {
  const max = ref.book === "PSA" ? 151 : book(ref.book).chapters;
  if (ref.chapterStart < 1 || ref.chapterEnd > max || ref.chapterEnd < ref.chapterStart) return null;
  if (ref.chapterStart === 151 && !ref.typedLxx) return null;
  if (ref.verseStart !== null && ref.verseStart < 1) return null;
  if (ref.chapterEnd === ref.chapterStart && ref.verseStart !== null && ref.verseEnd !== null && ref.verseEnd < ref.verseStart) return null;
  return ref;
}

/** "Jean 3, 16-18" / "John 3:16-18"; "Psaume 23, 1-4" / "Psalm 23:1-4". */
export function formatReference(r: Range, locale: "fr" | "en", opts: { abbreviated?: boolean } = {}): string {
  const b = book(r.book);
  const psalm = r.book === "PSA";
  const name = opts.abbreviated ? (locale === "fr" ? b.abbr_fr : b.abbr_en) : psalm ? (locale === "fr" ? "Psaume" : "Psalm") : locale === "fr" ? b.name_fr : b.name_en;
  const sep = locale === "fr" ? ", " : ":";
  if (r.chapterStart === r.chapterEnd) {
    const verses = r.verseStart === r.verseEnd ? `${r.verseStart}` : `${r.verseStart}-${r.verseEnd}`;
    return `${name} ${r.chapterStart}${sep}${verses}`;
  }
  return `${name} ${r.chapterStart}${sep}${r.verseStart} – ${r.chapterEnd}${sep}${r.verseEnd}`;
}

/** Compact key used in URLs and in sources.bible_refs: "JHN 3:16". */
export function verseKey(bookCode: string, chapter: number, verse: number): string {
  return `${bookCode} ${chapter}:${verse}`;
}
