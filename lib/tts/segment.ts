/**
 * Splits a card into short "reading units" (one TTS request each) so playback
 * starts fast, the next units can be prefetched, and the current sentence can
 * be highlighted.
 */
import type { TtsLanguage } from "./voices";

export type UnitPart = "title" | "passage" | "body" | "label" | "action";
/** Who speaks: the Bible text and the commentary are read with two different voices. */
export type VoiceRole = "scripture" | "commentary";
export const roleOf = (part: UnitPart): VoiceRole => (part === "title" || part === "passage" ? "scripture" : "commentary");
export type ReadingUnit = { part: UnitPart; index: number; text: string };
export type ReadingPosition = { part: UnitPart; index: number };

export const MAX_UNIT_CHARS = 500;

function hardSplit(sentence: string, max: number): string[] {
  const out: string[] = [];
  let rest = sentence.trim();
  while (rest.length > max) {
    const window = rest.slice(0, max);
    const cut = Math.max(window.lastIndexOf(", "), window.lastIndexOf("; "), window.lastIndexOf(" "));
    const at = cut > max * 0.4 ? cut + 1 : max;
    out.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) out.push(rest);
  return out;
}

/** Sentences of `text`, each at most `max` characters. Joined with spaces they rebuild the text. */
export function splitSentences(text: string, language: TtsLanguage, max: number = MAX_UNIT_CHARS): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const segmenter = new Intl.Segmenter(language, { granularity: "sentence" });
  const sentences = [...segmenter.segment(clean)].map((s) => s.segment.trim()).filter((s) => /[\p{L}\p{N}]/u.test(s));
  return sentences.flatMap((s) => (s.length > max ? hardSplit(s, max) : [s]));
}

export type SpeakableCard = { reference: string; verses: string[]; plain_explanation: string; action_step: string };

/** Units of a card: reference, each verse, the explanation, then the "to live" block. */
export function buildUnits(card: SpeakableCard, actionLabel: string, language: TtsLanguage): ReadingUnit[] {
  return [
    ...(card.reference ? [{ part: "title" as const, index: 0, text: card.reference }] : []),
    ...card.verses.flatMap((verse, index) => splitSentences(verse, language).length ? [{ part: "passage" as const, index, text: verse }] : []),
    ...splitSentences(card.plain_explanation, language).map((text, index) => ({ part: "body" as const, index, text })),
    { part: "label" as const, index: 0, text: actionLabel },
    ...splitSentences(card.action_step, language).map((text, index) => ({ part: "action" as const, index, text })),
  ];
}

/** Strips characters the speech service reads badly (guillemets, stray markup). */
export function speakable(text: string): string {
  return text.replace(/[«»“”]/g, '"').replace(/[<>]/g, " ").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Audio segments: a card is read as a few requests, not one per sentence.
// ---------------------------------------------------------------------------

export type Segment = { text: string; units: ReadingUnit[]; role: VoiceRole };

/** Text sent to the voice for one unit: always ends with a stop so the intonation closes. */
export function spoken(text: string): string {
  const s = speakable(text);
  return /[.!?…:;]["')»”]*$/.test(s) ? s : `${s}.`;
}

/**
 * Groups reading units into a few audio segments. The first one is short so that
 * playback starts quickly; the next ones are longer and are prefetched while the
 * previous one plays. The "À faire aujourd'hui" label never ends a segment.
 */
export function buildSegments(units: ReadingUnit[], firstMax = 170, restMax = 420): Segment[] {
  const segments: Segment[] = [];
  let current: ReadingUnit[] = [];
  let length = 0;
  const flush = () => {
    if (current.length === 0) return;
    segments.push({ units: current, role: roleOf(current[0]!.part), text: current.map((u) => spoken(u.text)).join(" ") });
    current = [];
    length = 0;
  };
  for (const unit of units) {
    const size = spoken(unit.text).length + 1;
    const max = segments.length === 0 ? firstMax : restMax;
    const gluedToNext = current[current.length - 1]?.part === "label";
    const roleChanges = current.length > 0 && roleOf(current[0]!.part) !== roleOf(unit.part);
    if (current.length > 0 && (roleChanges || (!gluedToNext && length + size > max))) flush();
    current.push(unit);
    length += size;
  }
  flush();
  return segments;
}

/**
 * Which unit of a segment is being spoken, from the playback position (0..1).
 * Speech time is proportional to the text length plus a small pause allowance per unit.
 */
export function unitAtFraction(units: ReadingUnit[], fraction: number): number {
  if (units.length <= 1) return 0;
  const weights = units.map((u) => spoken(u.text).length + 8);
  const total = weights.reduce((a, b) => a + b, 0);
  const target = Math.min(Math.max(fraction, 0), 0.999999) * total;
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i]!;
    if (target < acc) return i;
  }
  return units.length - 1;
}
