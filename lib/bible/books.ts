/**
 * The books Logion covers: the 27 books of the New Testament and the Psalms.
 * Codes are USFM/Paratext codes, as used by eBible.org files.
 */

export type BookGroup = "gospels" | "acts" | "pauline" | "catholic" | "revelation" | "psalms";

export type BookInfo = {
  code: string;
  order: number;
  group: BookGroup;
  chapters: number;
  name_fr: string;
  name_en: string;
  /** Short form shown in references, e.g. "Jn", "1 Co". */
  abbr_fr: string;
  abbr_en: string;
  /** Extra spellings accepted by the reference parser (lowercase, no accents, no spaces). */
  aliases: string[];
  /** Book name in the scrollmapper CSV files (DRC, Giguet). */
  scrollmapper: string;
};

const B = (
  code: string,
  group: BookGroup,
  chapters: number,
  name_fr: string,
  name_en: string,
  abbr_fr: string,
  abbr_en: string,
  scrollmapper: string,
  aliases: string[],
): Omit<BookInfo, "order"> => ({ code, group, chapters, name_fr, name_en, abbr_fr, abbr_en, scrollmapper, aliases });

const LIST = [
  B("MAT", "gospels", 28, "Matthieu", "Matthew", "Mt", "Matt", "Matthew", ["mt", "mat", "matt", "matthieu", "matthew", "mth"]),
  B("MRK", "gospels", 16, "Marc", "Mark", "Mc", "Mark", "Mark", ["mc", "mk", "mr", "mrk", "marc", "mark"]),
  B("LUK", "gospels", 24, "Luc", "Luke", "Lc", "Luke", "Luke", ["lc", "lk", "lu", "luk", "luc", "luke"]),
  B("JHN", "gospels", 21, "Jean", "John", "Jn", "John", "John", ["jn", "jhn", "joh", "jean", "john"]),
  B("ACT", "acts", 28, "Actes des Apôtres", "Acts", "Ac", "Acts", "Acts", ["ac", "act", "acts", "actes", "actesdesapotres"]),
  B("ROM", "pauline", 16, "Romains", "Romans", "Rm", "Rom", "Romans", ["rm", "ro", "rom", "romains", "romans"]),
  B("1CO", "pauline", 16, "1 Corinthiens", "1 Corinthians", "1 Co", "1 Cor", "I Corinthians", ["1co", "1cor", "1corinthiens", "1corinthians", "icor", "ico"]),
  B("2CO", "pauline", 13, "2 Corinthiens", "2 Corinthians", "2 Co", "2 Cor", "II Corinthians", ["2co", "2cor", "2corinthiens", "2corinthians", "iicor", "iico"]),
  B("GAL", "pauline", 6, "Galates", "Galatians", "Ga", "Gal", "Galatians", ["ga", "gal", "galates", "galatians"]),
  B("EPH", "pauline", 6, "Éphésiens", "Ephesians", "Ep", "Eph", "Ephesians", ["ep", "eph", "ephesiens", "ephesians"]),
  B("PHP", "pauline", 4, "Philippiens", "Philippians", "Ph", "Phil", "Philippians", ["ph", "php", "phil", "philippiens", "philippians"]),
  B("COL", "pauline", 4, "Colossiens", "Colossians", "Col", "Col", "Colossians", ["col", "colossiens", "colossians"]),
  B("1TH", "pauline", 5, "1 Thessaloniciens", "1 Thessalonians", "1 Th", "1 Thess", "I Thessalonians", ["1th", "1thes", "1thess", "1thessaloniciens", "1thessalonians"]),
  B("2TH", "pauline", 3, "2 Thessaloniciens", "2 Thessalonians", "2 Th", "2 Thess", "II Thessalonians", ["2th", "2thes", "2thess", "2thessaloniciens", "2thessalonians"]),
  B("1TI", "pauline", 6, "1 Timothée", "1 Timothy", "1 Tm", "1 Tim", "I Timothy", ["1tm", "1ti", "1tim", "1timothee", "1timothy"]),
  B("2TI", "pauline", 4, "2 Timothée", "2 Timothy", "2 Tm", "2 Tim", "II Timothy", ["2tm", "2ti", "2tim", "2timothee", "2timothy"]),
  B("TIT", "pauline", 3, "Tite", "Titus", "Tt", "Titus", "Titus", ["tt", "tit", "tite", "titus"]),
  B("PHM", "pauline", 1, "Philémon", "Philemon", "Phm", "Phlm", "Philemon", ["phm", "phlm", "philem", "philemon"]),
  B("HEB", "pauline", 13, "Hébreux", "Hebrews", "He", "Heb", "Hebrews", ["he", "hb", "heb", "hebreux", "hebrews"]),
  B("JAS", "catholic", 5, "Jacques", "James", "Jc", "Jas", "James", ["jc", "jq", "jas", "jac", "jacques", "james", "jm"]),
  B("1PE", "catholic", 5, "1 Pierre", "1 Peter", "1 P", "1 Pet", "I Peter", ["1p", "1pe", "1pi", "1pet", "1pierre", "1peter"]),
  B("2PE", "catholic", 3, "2 Pierre", "2 Peter", "2 P", "2 Pet", "II Peter", ["2p", "2pe", "2pi", "2pet", "2pierre", "2peter"]),
  B("1JN", "catholic", 5, "1 Jean", "1 John", "1 Jn", "1 John", "I John", ["1jn", "1jean", "1john", "1jo", "1joh"]),
  B("2JN", "catholic", 1, "2 Jean", "2 John", "2 Jn", "2 John", "II John", ["2jn", "2jean", "2john", "2jo", "2joh"]),
  B("3JN", "catholic", 1, "3 Jean", "3 John", "3 Jn", "3 John", "III John", ["3jn", "3jean", "3john", "3jo", "3joh"]),
  B("JUD", "catholic", 1, "Jude", "Jude", "Jude", "Jude", "Jude", ["jud", "jude", "jd"]),
  B("REV", "revelation", 22, "Apocalypse", "Revelation", "Ap", "Rev", "Revelation of John", ["ap", "apo", "apoc", "apocalypse", "rev", "revelation", "re", "rv"]),
  B("PSA", "psalms", 150, "Psaumes", "Psalms", "Ps", "Ps", "Psalms", ["ps", "psa", "pss", "psaume", "psaumes", "psalm", "psalms", "psaum"]),
];

export const BOOKS: BookInfo[] = LIST.map((b, i) => ({ ...b, order: i + 1 }));
export const NT_BOOKS = BOOKS.filter((b) => b.group !== "psalms");
export const BOOK_BY_CODE = new Map(BOOKS.map((b) => [b.code, b]));
export const BOOK_GROUPS: BookGroup[] = ["gospels", "acts", "pauline", "catholic", "revelation", "psalms"];

export function book(code: string): BookInfo {
  const info = BOOK_BY_CODE.get(code);
  if (!info) throw new Error(`unknown book ${code}`);
  return info;
}

export function isBookCode(code: string): boolean {
  return BOOK_BY_CODE.has(code);
}

/** Orderable key for a verse: book order, chapter, verse. */
export function sortKey(code: string, chapter: number, verse: number): number {
  return book(code).order * 1_000_000 + chapter * 1000 + verse;
}

export function bookName(code: string, locale: "fr" | "en"): string {
  const b = book(code);
  return locale === "fr" ? b.name_fr : b.name_en;
}
