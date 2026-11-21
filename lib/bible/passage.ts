/**
 * Loading the text of a passage in a given version, from the database only.
 *
 * Passages are stored in the reference numbering; each verse is mapped into
 * the numbering of the version (lib/bible/psalms.ts). A chapter whose verse
 * division differs in that version (bible_chapter_stats.aligned = false) is
 * never mapped: the next version of the fallback list is used instead, and the
 * result says so.
 */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { PSALM_151_VERSES, toVersionRef, type Versification } from "./psalms";
import type { Range } from "./reference";

type Db = SupabaseClient<Database>;

export const REFERENCE_VERSION = "LSG1910";
/** Psalm 151 has no Hebrew text: Brenton is its reference text. */
export const PSALM_151_REFERENCE_VERSION = "BRENTON_LXX";

export type VersionInfo = { id: string; code: string; name: string; language: "fr" | "en" | "grc"; versification: Versification; license: string };
export type PassageVerse = { chapter: number; verse: number; text: string };
export type PassageText = {
  version: string;
  versionName: string;
  language: "fr" | "en" | "grc";
  verses: PassageVerse[];
  /** Set when the first version asked for could not be used. */
  fallbackFrom: string | null;
};

let versionCache: Promise<Map<string, VersionInfo>> | null = null;
let alignmentCache: Promise<Set<string>> | null = null;

export function resetBibleCaches() {
  versionCache = null;
  alignmentCache = null;
}

export function bibleVersions(db: Db): Promise<Map<string, VersionInfo>> {
  versionCache ??= (async () => {
    const { data, error } = await db.from("bible_versions").select("id, code, name, language, versification, license").not("imported_at", "is", null);
    if (error) throw new Error(error.message);
    return new Map(data.map((v) => [v.code, v as VersionInfo]));
  })();
  return versionCache.catch((e) => {
    versionCache = null;
    throw e;
  });
}

/** "versionId BOOK chapter" for every chapter whose numbering is NOT aligned. */
function misalignedChapters(db: Db): Promise<Set<string>> {
  alignmentCache ??= (async () => {
    const out = new Set<string>();
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from("bible_chapter_stats").select("version_id, book_code, chapter").eq("aligned", false).range(from, from + 999);
      if (error) throw new Error(error.message);
      for (const r of data) out.add(`${r.version_id} ${r.book_code} ${r.chapter}`);
      if (data.length < 1000) break;
    }
    return out;
  })();
  return alignmentCache.catch((e) => {
    alignmentCache = null;
    throw e;
  });
}

function inRange(r: Range, chapter: number, verse: number): boolean {
  const k = chapter * 1000 + verse;
  return k >= r.chapterStart * 1000 + r.verseStart && k <= r.chapterEnd * 1000 + r.verseEnd;
}

async function rows(db: Db, versionId: string, bookCode: string, chapterFrom: number, chapterTo: number): Promise<PassageVerse[]> {
  const { data, error } = await db
    .from("bible_verses")
    .select("chapter, verse, text")
    .eq("version_id", versionId)
    .eq("book_code", bookCode)
    .gte("chapter", chapterFrom)
    .lte("chapter", chapterTo)
    .order("chapter")
    .order("verse");
  if (error) throw new Error(error.message);
  return data;
}

/** Verses of the range in the reference numbering, as they exist in the reference text. */
export async function referenceText(db: Db, r: Range): Promise<PassageText> {
  const versions = await bibleVersions(db);
  const code = r.book === "PSA" && r.chapterStart === 151 ? PSALM_151_REFERENCE_VERSION : REFERENCE_VERSION;
  const v = versions.get(code);
  if (!v) throw new Error(`version ${code} is not imported (npm run import:bible)`);
  const verses = (await rows(db, v.id, r.book, r.chapterStart, r.chapterEnd)).filter((x) => inRange(r, x.chapter, x.verse));
  if (r.book === "PSA" && r.chapterStart === 151 && verses.some((x) => x.verse > PSALM_151_VERSES)) throw new Error("unexpected Psalm 151 verse");
  return { version: v.code, versionName: v.name, language: v.language, verses, fallbackFrom: null };
}

/** Text of the range in one version, or null when that version cannot show it faithfully. */
export async function versionText(db: Db, code: string, r: Range, reference?: PassageText): Promise<PassageText | null> {
  const versions = await bibleVersions(db);
  const v = versions.get(code);
  if (!v) return null;
  const ref = reference ?? (await referenceText(db, r));
  if (ref.version === code) return ref;
  const mapped = ref.verses.map((x) => toVersionRef(v.versification, r.book, x.chapter, x.verse)).filter((x): x is NonNullable<typeof x> => !!x);
  if (mapped.length === 0) return null;
  const misaligned = await misalignedChapters(db);
  if (mapped.some((m) => misaligned.has(`${v.id} ${r.book} ${m.chapter}`))) return null;
  const chapters = mapped.map((m) => m.chapter);
  const all = await rows(db, v.id, r.book, Math.min(...chapters), Math.max(...chapters));
  const byKey = new Map(all.map((x) => [`${x.chapter}:${x.verse}`, x]));
  const verses = mapped.map((m) => byKey.get(`${m.chapter}:${m.verse}`)).filter((x): x is PassageVerse => !!x);
  if (verses.length === 0) return null;
  return { version: v.code, versionName: v.name, language: v.language, verses, fallbackFrom: null };
}

/** First version of `codes` able to show the range; `fallbackFrom` names the one that was asked for. */
export async function textWithFallback(db: Db, codes: string[], r: Range, reference?: PassageText): Promise<PassageText | null> {
  const ref = reference ?? (await referenceText(db, r));
  for (const [i, code] of codes.entries()) {
    const text = await versionText(db, code, r, ref);
    if (text) return { ...text, fallbackFrom: i === 0 ? null : codes[0]! };
  }
  return null;
}

/** sha256 of the reference text, stored on each card and re-checked by check:db. */
export function passageTextHash(text: Pick<PassageText, "version" | "verses">): string {
  const body = text.verses.map((v) => `${v.chapter}:${v.verse} ${v.text}`).join("\n");
  return createHash("sha256").update(`${text.version}\n${body}`).digest("hex");
}
