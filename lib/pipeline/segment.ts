/**
 * Deterministic cutting of a chapter into passages of 1 to 8 verses (no model).
 *
 * - A passage ends on a verse that closes a sentence (. ! ? or a closing quote).
 * - Target length 3 to 6 verses; never more than MAX_VERSES unless no sentence
 *   ends earlier (then the cut is forced at MAX_VERSES).
 * - Psalms: "Pause" (Selah) marks the end of a strophe; superscription verses
 *   stay with the first strophe.
 * - `offset` shifts the cuts (used by --extend to create new passages that do
 *   not duplicate the existing ones).
 * The result always covers the chapter exactly once: checked by `validateCoverage`.
 */

export type SegVerse = { verse: number; text: string };
export type Segment = { start: number; end: number };

export const MIN_VERSES = 3;
export const TARGET_VERSES = 4;
export const MAX_VERSES = 8;

const SENTENCE_END = /[.!?…](\s*[»"”’)\]])*\s*$/;
const PSALM_PAUSE = /(—\s*)?(Pause|Selah)\.?\s*$/i;

export function endsSentence(text: string): boolean {
  return SENTENCE_END.test(text.trim());
}

export function segmentChapter(verses: SegVerse[], opts: { psalm?: boolean; titleVerses?: number; offset?: number } = {}): Segment[] {
  if (verses.length === 0) return [];
  const out: Segment[] = [];
  let i = 0;
  // Short chapters (a whole short psalm, Philemon-like books) stay whole.
  if (verses.length <= MAX_VERSES && (opts.psalm || verses.length <= TARGET_VERSES)) {
    return [{ start: verses[0]!.verse, end: verses.at(-1)!.verse }];
  }
  let firstMin = MIN_VERSES + (opts.titleVerses ?? 0);
  const offset = opts.offset ?? 0;
  while (i < verses.length) {
    const remaining = verses.length - i;
    if (remaining <= MAX_VERSES && remaining <= TARGET_VERSES + 1) {
      out.push({ start: verses[i]!.verse, end: verses.at(-1)!.verse });
      break;
    }
    // The offset shortens the first passage only, which shifts every later cut.
    const targetLen = out.length === 0 && offset > 0 ? Math.max(1, TARGET_VERSES - offset) : TARGET_VERSES;
    const minLen = Math.max(1, Math.min(firstMin, targetLen));
    let cut = -1;
    // Psalm strophes first, then sentence ends, preferring the target length.
    const candidates: number[] = [];
    for (let k = i + minLen - 1; k < Math.min(verses.length, i + MAX_VERSES); k++) {
      const t = verses[k]!.text;
      if ((opts.psalm && PSALM_PAUSE.test(t)) || endsSentence(t)) candidates.push(k);
    }
    const pause = opts.psalm ? candidates.find((k) => PSALM_PAUSE.test(verses[k]!.text)) : undefined;
    if (pause !== undefined) cut = pause;
    else if (candidates.length) {
      const target = i + targetLen - 1;
      cut = candidates.reduce((best, k) => (Math.abs(k - target) < Math.abs(best - target) ? k : best), candidates[0]!);
    } else cut = Math.min(verses.length - 1, i + MAX_VERSES - 1);
    // Never leave a tail of one or two verses: absorb it when the total stays within MAX_VERSES.
    const tail = verses.length - 1 - cut;
    if (tail > 0 && tail < MIN_VERSES && cut - i + 1 + tail <= MAX_VERSES) cut = verses.length - 1;
    out.push({ start: verses[i]!.verse, end: verses[cut]!.verse });
    i = cut + 1;
    firstMin = MIN_VERSES;
  }
  return out;
}

/** Every verse exactly once, in order, segments of 1 to MAX_VERSES verses. */
export function validateCoverage(verses: SegVerse[], segments: Segment[]): string[] {
  const errors: string[] = [];
  const numbers = verses.map((v) => v.verse);
  const covered: number[] = [];
  for (const s of segments) {
    const inside = numbers.filter((n) => n >= s.start && n <= s.end);
    if (inside.length === 0) errors.push(`empty segment ${s.start}-${s.end}`);
    if (inside.length > MAX_VERSES) errors.push(`segment ${s.start}-${s.end} has ${inside.length} verses`);
    covered.push(...inside);
  }
  if (covered.length !== numbers.length || covered.some((n, i) => n !== numbers[i])) errors.push("verses skipped, duplicated or out of order");
  return errors;
}
