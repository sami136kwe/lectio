/**
 * Deterministic parsers for the Bible source files. No network, no model:
 * pure functions from file contents to verses, unit-tested on fixtures.
 */
import { BOOKS, isBookCode } from "./books";

export type ParsedVerse = { book: string; chapter: number; verse: number; text: string };

/** Unicode NFC, non-breaking spaces as spaces, single spaces, trimmed. */
export function normalizeVerseText(text: string): string {
  return text.normalize("NFC").replace(/[  -​ ]/g, " ").replace(/\s+/g, " ").trim();
}

export function refKey(book: string, chapter: number, verse: number): string {
  return `${book} ${chapter}:${verse}`;
}

function parseRef(ref: string): { book: string; chapter: number; verse: number } | null {
  const m = /^([1-3A-Z]{3}) (\d+):(\d+)$/.exec(ref.trim());
  if (!m) return null;
  return { book: m[1]!, chapter: Number(m[2]), verse: Number(m[3]) };
}

/**
 * eBible corpus format: one verse per line, aligned with vref.txt. Empty lines
 * are verses the edition does not have; "<range>" marks a verse merged into the
 * previous line (kept as missing). "PS2 1:n" is the Septuagint Psalm 151.
 */
export function parseVrefCorpus(vref: string, corpus: string, keep: Set<string>): ParsedVerse[] {
  const refs = vref.split(/\r?\n/);
  const lines = corpus.split(/\r?\n/);
  const out: ParsedVerse[] = [];
  for (let i = 0; i < refs.length; i++) {
    const raw = refs[i]!.startsWith("PS2 ") ? refs[i]!.replace(/^PS2 1:/, "PSA 151:") : refs[i]!;
    const ref = parseRef(raw);
    if (!ref || !keep.has(ref.book)) continue;
    const text = normalizeVerseText(lines[i] ?? "");
    if (!text || text === "<range>") continue;
    out.push({ ...ref, text });
  }
  return out;
}

/** Minimal RFC 4180 CSV reader (quoted fields, doubled quotes, CRLF). */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i]!;
    if (quoted) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** scrollmapper/bible_databases CSV: Book,Chapter,Verse,Text (empty Text = no verse). */
export function parseScrollmapperCsv(csv: string, keep: Set<string>): ParsedVerse[] {
  const byName = new Map(BOOKS.map((b) => [b.scrollmapper, b.code]));
  const rows = parseCsv(csv);
  const header = rows[0]?.join(",");
  if (header !== "Book,Chapter,Verse,Text") throw new Error(`unexpected CSV header: ${header}`);
  const out: ParsedVerse[] = [];
  for (const r of rows.slice(1)) {
    if (r.length < 4) continue;
    const code = byName.get(r[0]!);
    if (!code || !keep.has(code)) continue;
    const text = normalizeVerseText(r[3]!);
    if (!text) continue;
    out.push({ book: code, chapter: Number(r[1]), verse: Number(r[2]), text });
  }
  return out;
}

/**
 * Brenton JSON ({ "Psalms": { "1": [{ v, t }] } }). The last verse of each
 * psalm carries the page footer of the source HTML ("Psalms < 1 > *1:1 Gr.
 * pestilent. ... Public Domain"): it is cut off deterministically.
 */
export function cleanBrentonVerse(text: string): string {
  return normalizeVerseText(text.replace(/\s*Psalms\s*<\s*\d+\s*>[\s\S]*$/, ""));
}

export function parseBrentonJson(json: string): ParsedVerse[] {
  const data = JSON.parse(json) as Record<string, Record<string, { v: number; t: string }[]>>;
  const psalms = data.Psalms;
  if (!psalms) throw new Error("no Psalms in Brenton file");
  const out: ParsedVerse[] = [];
  for (const [chapter, verses] of Object.entries(psalms)) {
    for (const { v, t } of verses) {
      const text = cleanBrentonVerse(t);
      if (text) out.push({ book: "PSA", chapter: Number(chapter), verse: v, text });
    }
  }
  return out.sort((a, b) => a.chapter - b.chapter || a.verse - b.verse);
}

/** Letters and digits only, lowercase, without accents: for provenance cross-checks. */
export function looseText(text: string): string {
  return text.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Share of verses whose text appears in the licensed copy (any position). */
export function confirmedRatio(verses: ParsedVerse[], licensedText: string): number {
  if (verses.length === 0) return 0;
  const haystack = looseText(licensedText);
  const confirmed = verses.filter((v) => haystack.includes(looseText(v.text))).length;
  return confirmed / verses.length;
}

export function assertBookCodes(verses: ParsedVerse[]): void {
  for (const v of verses) if (!isBookCode(v.book)) throw new Error(`unknown book ${v.book}`);
}
