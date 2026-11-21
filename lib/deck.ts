/**
 * Daily deck sizing. "50": up to 50 cards, fixed for the day. "unlimited"
 * (default): starts with UNLIMITED_BATCH cards and grows by the same amount
 * when the reader gets close to the end.
 */
export const DECK_LIMIT_50 = 50;
export const UNLIMITED_BATCH = 20;
export const EXTEND_MARGIN = 3;

export type DailyLimit = "50" | "unlimited";

/** How many cards to add to a deck that has `count` cards, the reader being at `position` (1-based). */
export function cardsToAdd(limit: DailyLimit, count: number, position: number): number {
  if (limit === "50") return count === 0 ? DECK_LIMIT_50 : 0;
  if (count === 0) return UNLIMITED_BATCH;
  return position >= count - EXTEND_MARGIN ? UNLIMITED_BATCH : 0;
}

/** Position after a move, kept inside the deck. */
export function clampPosition(position: number, count: number): number {
  if (count <= 0) return 1;
  return Math.min(Math.max(1, Math.round(position)), count);
}
