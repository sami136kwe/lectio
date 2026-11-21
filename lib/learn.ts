/**
 * "Learn this verse": progressive masking. At level n (0-5), about n × 18 %
 * of the words of 3 letters or more are hidden, always the same ones for a
 * given text (stable hash), and each level hides the previous level's words too.
 */
import type { ReviewRating } from "@/lib/srs/sm2";

export const MAX_MASK_LEVEL = 5;
const SHARE_PER_LEVEL = 0.18;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type MaskedToken = { text: string; hidden: boolean };

export function maskWords(text: string, level: number): MaskedToken[] {
  const tokens = text.split(/(\s+)/);
  const words = tokens.map((t, i) => ({ t, i })).filter(({ t }) => /\p{L}{3,}/u.test(t));
  // Rank words by a stable hash: the lowest ranks are hidden first, so levels are nested.
  const ranked = [...words].sort((a, b) => hash(`${a.i}:${a.t}`) - hash(`${b.i}:${b.t}`));
  const count = Math.min(words.length, Math.round(words.length * SHARE_PER_LEVEL * Math.max(0, Math.min(level, MAX_MASK_LEVEL))));
  const hidden = new Set(ranked.slice(0, count).map((w) => w.i));
  return tokens.map((t, i) => ({ text: t, hidden: hidden.has(i) }));
}

export function nextMaskLevel(level: number, rating: ReviewRating): number {
  if (rating >= 3) return Math.min(MAX_MASK_LEVEL, level + 1);
  if (rating === 1) return Math.max(0, level - 1);
  return level;
}
