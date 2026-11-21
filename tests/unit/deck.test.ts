import { describe, expect, it } from "vitest";
import { cardsToAdd, clampPosition, DECK_LIMIT_50, UNLIMITED_BATCH } from "@/lib/deck";

describe("daily deck sizing", () => {
  it("fills a 50-card deck once and never grows it", () => {
    expect(cardsToAdd("50", 0, 1)).toBe(DECK_LIMIT_50);
    expect(cardsToAdd("50", 50, 50)).toBe(0);
    expect(cardsToAdd("50", 12, 12)).toBe(0); // fewer cards were available: no top-up the same day
  });

  it("grows an unlimited deck near its end", () => {
    expect(cardsToAdd("unlimited", 0, 1)).toBe(UNLIMITED_BATCH);
    expect(cardsToAdd("unlimited", 20, 5)).toBe(0);
    expect(cardsToAdd("unlimited", 20, 17)).toBe(UNLIMITED_BATCH);
  });

  it("keeps the position inside the deck", () => {
    expect(clampPosition(0, 10)).toBe(1);
    expect(clampPosition(11, 10)).toBe(10);
    expect(clampPosition(4, 0)).toBe(1);
  });
});
