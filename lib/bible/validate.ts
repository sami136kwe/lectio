/**
 * Integrity checks run on every imported version before anything is written:
 * encoding, duplicates, complete NT coverage (only documented variants may be
 * missing), every psalm present, and per-chapter alignment of the numbering.
 */
import { NT_BOOKS } from "./books";
import { refKey, type ParsedVerse } from "./parse";
import { expectedPsalmCount } from "./psalms";
import type { VersionDef } from "./versions";

export type ChapterStat = { book: string; chapter: number; verse_count: number; expected_count: number; aligned: boolean };

export type ValidationReport = {
  code: string;
  verses: number;
  ntVerses: number;
  psalmVerses: number;
  errors: string[];
  warnings: string[];
  chapters: ChapterStat[];
};

/** Replacement characters, typical UTF-8-read-as-Latin-1 sequences, control characters. */
const BAD_ENCODING = /�|Ã[\u0080-¿]|â€|[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export function encodingProblem(text: string): boolean {
  return BAD_ENCODING.test(text);
}

/** Reference NT verse keys ("MAT 1:1") from the eBible vref list. */
export function ntReferenceKeys(vref: string): Set<string> {
  const nt = new Set(NT_BOOKS.map((b) => b.code));
  const keys = new Set<string>();
  for (const line of vref.split(/\r?\n/)) {
    const m = /^([1-3A-Z]{3}) (\d+):(\d+)$/.exec(line.trim());
    if (m && nt.has(m[1]!)) keys.add(`${m[1]} ${Number(m[2])}:${Number(m[3])}`);
  }
  return keys;
}

export function validateVersion(def: Pick<VersionDef, "code" | "scope" | "versification" | "allowedMissing" | "allowedExtra" | "divergentChapters">, verses: ParsedVerse[], ntKeys: Set<string>): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const chapters: ChapterStat[] = [];
  const seen = new Set<string>();

  for (const v of verses) {
    const key = refKey(v.book, v.chapter, v.verse);
    if (seen.has(key)) errors.push(`duplicate verse ${key}`);
    seen.add(key);
    if (!Number.isInteger(v.chapter) || !Number.isInteger(v.verse) || v.chapter < 1 || v.verse < 1) errors.push(`bad reference ${key}`);
    if (encodingProblem(v.text)) errors.push(`encoding problem in ${key}`);
    if (v.text.length > 2000) errors.push(`verse too long ${key}`);
  }

  const wantsNt = def.scope !== "psalms";
  const wantsPsalms = def.scope !== "nt";
  const nt = verses.filter((v) => v.book !== "PSA");
  const ps = verses.filter((v) => v.book === "PSA");
  if (!wantsNt && nt.length) errors.push(`${nt.length} NT verses in a Psalms-only version`);
  if (!wantsPsalms && ps.length) errors.push(`${ps.length} Psalm verses in an NT-only version`);

  if (wantsNt) {
    const allowed = new Set(def.allowedMissing);
    for (const key of ntKeys) {
      if (!seen.has(key) && !allowed.has(key)) errors.push(`missing NT verse ${key}`);
      if (seen.has(key) && allowed.has(key)) warnings.push(`${key} is listed as allowed missing but is present`);
    }
    for (const v of nt) {
      const key = refKey(v.book, v.chapter, v.verse);
      if (!ntKeys.has(key) && !def.allowedExtra?.includes(key)) errors.push(`unexpected NT verse ${key}`);
    }
    const expectedPerChapter = new Map<string, number>();
    for (const key of [...ntKeys, ...(def.allowedExtra ?? [])]) {
      if (allowed.has(key)) continue;
      const ch = key.slice(0, key.indexOf(":"));
      expectedPerChapter.set(ch, (expectedPerChapter.get(ch) ?? 0) + 1);
    }
    const found = new Map<string, number>();
    for (const v of nt) found.set(`${v.book} ${v.chapter}`, (found.get(`${v.book} ${v.chapter}`) ?? 0) + 1);
    for (const b of NT_BOOKS) {
      for (let c = 1; c <= b.chapters; c++) {
        const k = `${b.code} ${c}`;
        const count = found.get(k) ?? 0;
        const expected = expectedPerChapter.get(k) ?? 0;
        if (count === 0) errors.push(`missing chapter ${k}`);
        const divergent = def.divergentChapters?.includes(k) ?? false;
        chapters.push({ book: b.code, chapter: c, verse_count: count, expected_count: expected, aligned: count === expected && !divergent });
      }
    }
  }

  if (wantsPsalms) {
    const byChapter = new Map<number, number[]>();
    for (const v of ps) byChapter.set(v.chapter, [...(byChapter.get(v.chapter) ?? []), v.verse]);
    const last = def.versification === "lxx" ? 151 : 150;
    for (let c = 1; c <= last; c++) {
      const nums = (byChapter.get(c) ?? []).sort((a, b) => a - b);
      const expected = expectedPsalmCount(def.versification, c);
      if (nums.length === 0) {
        if (c === 151) warnings.push("Psalm 151 is not in this edition");
        else errors.push(`missing psalm ${c}`);
        continue;
      }
      const contiguous = nums.every((n, i) => n === i + 1);
      const aligned = contiguous && nums.length === expected;
      if (!aligned) warnings.push(`Psalm ${c}: ${nums.length} verses, ${expected} expected${contiguous ? "" : " (gaps)"}: numbering not aligned`);
      chapters.push({ book: "PSA", chapter: c, verse_count: nums.length, expected_count: expected, aligned });
    }
    for (const c of byChapter.keys()) if (c > last || c < 1) errors.push(`unexpected psalm ${c}`);
  }

  return { code: def.code, verses: verses.length, ntVerses: nt.length, psalmVerses: ps.length, errors, warnings, chapters };
}
