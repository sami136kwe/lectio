import { describe, expect, it } from "vitest";
import { maskWords, nextMaskLevel } from "@/lib/learn";

const text = "Car Dieu a tant aimé le monde qu'il a donné son Fils unique, afin que quiconque croit en lui ne périsse point.";

describe("learn a verse", () => {
  it("hides nothing at level 0 and more words at each level, the earlier ones included", () => {
    const hiddenAt = (l: number) => new Set(maskWords(text, l).flatMap((t, i) => (t.hidden ? [i] : [])));
    expect(hiddenAt(0).size).toBe(0);
    for (let l = 1; l <= 5; l++) {
      const prev = hiddenAt(l - 1);
      const cur = hiddenAt(l);
      expect(cur.size).toBeGreaterThan(prev.size);
      for (const i of prev) expect(cur.has(i)).toBe(true);
    }
  });

  it("keeps the text intact and is stable", () => {
    expect(maskWords(text, 3).map((t) => t.text).join("")).toBe(text);
    expect(maskWords(text, 3)).toEqual(maskWords(text, 3));
    expect(maskWords(text, 5).filter((t) => t.hidden).every((t) => /\p{L}{3,}/u.test(t.text))).toBe(true);
  });

  it("moves the level with the rating", () => {
    expect(nextMaskLevel(2, 4)).toBe(3);
    expect(nextMaskLevel(5, 3)).toBe(5);
    expect(nextMaskLevel(2, 1)).toBe(1);
    expect(nextMaskLevel(0, 1)).toBe(0);
    expect(nextMaskLevel(2, 2)).toBe(2);
  });
});
