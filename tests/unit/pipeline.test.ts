import { describe, expect, it } from "vitest";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { estimateCost, usageCost } from "@/lib/pipeline/model";
import { cardOutputSchema, TheologyOutput, WRITER_SYSTEM, writerUserPrompt } from "@/lib/pipeline/prompt";
import { evaluateCard } from "@/lib/pipeline/evaluate";

describe("pipeline prompts and schemas", () => {
  it("converts both output schemas to JSON schemas for structured outputs", () => {
    const card = zodOutputFormat(cardOutputSchema(["paraboles", "miracles"]));
    expect(card.type).toBe("json_schema");
    expect(JSON.stringify(card.schema)).toContain("paraboles");
    expect(zodOutputFormat(TheologyOutput).schema).toBeDefined();
  });

  it("gives the exact passage and the sources, and forbids memory quotes", () => {
    const user = writerUserPrompt({
      reference: { fr: "Jean 3, 16", en: "John 3:16" },
      passage: { fr: "16 Car Dieu a tant aimé le monde", en: "16 For God so loved the world" },
      sources: [],
      categories: [{ slug: "croix-salut", label: "Cross and salvation" }],
    });
    expect(user).toContain("Car Dieu a tant aimé le monde");
    expect(user).toContain("(none: write without naming any author or document)");
    expect(WRITER_SYSTEM).toContain("Never quote Scripture from memory");
    expect(WRITER_SYSTEM).toContain("Never state a liturgical use");
  });

  it("computes batch costs at half price", () => {
    expect(usageCost("claude-sonnet-5-5", { input_tokens: 1_000_000, output_tokens: 0 })).toBeCloseTo(1);
    expect(usageCost("claude-sonnet-5-5", { input_tokens: 0, output_tokens: 1_000_000 })).toBeCloseTo(5);
    expect(estimateCost("claude-sonnet-5-5", [{ system: "x".repeat(3500), user: "" }], 1000)).toBeCloseTo(0.006, 6);
  });

  it("rejects a skipped card and unknown sources", () => {
    const base = cardOutputSchema(["miracles"]).parse({
      skip: "not enough material",
      category: "miracles",
      difficulty: 1,
      divergence_type: "agree",
      divergence_topic: null,
      fr: { explanation: "a", catholic: "b", orthodox: "c", divergence_summary: "d", action: "e" },
      en: { explanation: "a", catholic: "b", orthodox: "c", divergence_summary: "d", action: "e" },
      sources_used: [{ tradition: "catholic", source_id: "nope", usage: "quote", quote: null }],
    });
    expect(evaluateCard(base, { passageTexts: [], sources: [], categorySlugs: ["miracles"] }).reasons[0]).toMatch(/^model_skipped/);
    const r = evaluateCard({ ...base, skip: null }, { passageTexts: [], sources: [], categorySlugs: ["miracles"] }).reasons;
    expect(r).toContain("unknown_source:nope");
    expect(r).toContain("quote_missing:nope");
  });
});
