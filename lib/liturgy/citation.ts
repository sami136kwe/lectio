/**
 * Parser for the citations found in lectionary data files:
 * "Matthew 5:1-12a", "Matthew 9:36-10:8", "Luke 2:20-21, 40-52",
 * "I Timothy 3:13-16; 4:1-5", "Psalm 122: 1-2, 3-4", "John 1:1-18|John 1:1-5, 9-14".
 *
 * Partial verses ("12a", "19b") count as the whole verse. Alternatives
 * separated by "|" (long and short forms) keep the first, longest form.
 * Books outside Lectio (Old Testament except Psalms) return null.
 */
import { BOOKS } from "@/lib/bible/books";
import type { Range } from "@/lib/bible/reference";

const NAMES = new Map<string, string>();
for (const b of BOOKS) {
  for (const n of [b.name_en, b.scrollmapper, b.name_en.replace(/^1 /, "I ").replace(/^2 /, "II ").replace(/^3 /, "III ")]) NAMES.set(n.toLowerCase(), b.code);
}
NAMES.set("psalm", "PSA");
NAMES.set("psalms", "PSA");
NAMES.set("revelation", "REV");
NAMES.set("apocalypse", "REV");

const HEAD = /^\s*((?:I{1,3}|[1-3])?\s*[A-Za-z][A-Za-z ]*?)\s+(\d+)\s*:\s*(.+)$/;

export function parseCitation(input: string): Range[] | null {
  const first = input.split("|")[0]!.replace(/^cf\.\s*/i, "").trim();
  if (!first) return null;
  const head = HEAD.exec(first);
  if (!head) return null;
  const code = NAMES.get(head[1]!.trim().toLowerCase());
  if (!code) return null;
  let chapter = Number(head[2]);
  const out: Range[] = [];
  // ";" starts a new chapter ("3:13-16; 4:1-5"); "," continues in the current chapter.
  const groups = head[3]!.split(";").map((s) => s.trim()).filter(Boolean);
  for (const [gi, group] of groups.entries()) {
    let parts = group;
    if (gi > 0) {
      const m = /^(\d+)\s*:\s*(.+)$/.exec(group);
      if (!m) return null;
      chapter = Number(m[1]);
      parts = m[2]!;
    }
    for (const piece of parts.split(",").map((s) => s.trim()).filter(Boolean)) {
      const m = /^(\d+)[a-e]?(?:\s*[-–]\s*(?:(\d+)\s*:\s*)?(\d+)[a-e]?)?$/.exec(piece);
      if (!m) return null;
      const verseStart = Number(m[1]);
      const chapterEnd = m[2] ? Number(m[2]) : chapter;
      const verseEnd = m[3] ? Number(m[3]) : verseStart;
      if (chapterEnd < chapter || (chapterEnd === chapter && verseEnd < verseStart)) return null;
      out.push({ book: code, chapterStart: chapter, verseStart, chapterEnd, verseEnd });
      chapter = chapterEnd;
    }
  }
  return out.length ? out : null;
}
