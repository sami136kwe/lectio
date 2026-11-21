import { describe, expect, it } from "vitest";
import {
  checkAttributions,
  checkDivergence,
  checkQuotedScripture,
  checkSourceUse,
  checkStyle,
  imbalance,
  MAX_IMBALANCE,
  type CardText,
} from "@/lib/content/checks";
import { DEMO_CARDS } from "@/supabase/seed/demo-cards";

const text = (c: (typeof DEMO_CARDS)[number], language: "fr" | "en"): CardText => ({
  language,
  explanation: c.explanation[language],
  catholic: c.catholic[language],
  orthodox: c.orthodox[language],
  action: c.action[language],
  divergence_summary: c.divergence.summary[language],
});

describe("hand-written demo cards", () => {
  it("has at least 15 cards, 3 psalms and 3 known points of divergence", () => {
    expect(DEMO_CARDS.length).toBeGreaterThanOrEqual(15);
    expect(DEMO_CARDS.filter((c) => c.book === "PSA").length).toBeGreaterThanOrEqual(3);
    const topics = DEMO_CARDS.filter((c) => c.divergence.type === "differ").map((c) => c.divergence.topic);
    expect(topics.length).toBeGreaterThanOrEqual(3);
    expect(topics).toEqual(expect.arrayContaining(["filioque", "primacy", "marian-dogmas"]));
    expect(new Set(DEMO_CARDS.map((c) => c.key)).size).toBe(DEMO_CARDS.length);
  });

  it.each(DEMO_CARDS.flatMap((c) => (["fr", "en"] as const).map((l) => [c.key, l, c] as const)))("%s (%s) passes style, divergence and attribution rules", (_key, language, card) => {
    const t = text(card, language);
    expect(checkStyle(t).reasons).toEqual([]);
    expect(checkDivergence(t, card.divergence.type, card.divergence.topic).reasons).toEqual([]);
    for (const tradition of ["catholic", "orthodox"] as const) {
      const linked = card.sources.filter((s) => s.tradition === tradition).map((s) => ({ author: s.author, work: s.work, text: s.quote ?? null, quote: s.quote ?? null }));
      expect(checkAttributions(card[tradition][language], linked).reasons).toEqual([]);
    }
    expect(checkAttributions(t.explanation, []).reasons).toEqual([]);
    for (const s of card.sources) if (s.quote) expect(s.quote.split(/\s+/).length).toBeLessThan(25);
  });
});

describe("rules", () => {
  const good: CardText = {
    language: "fr",
    explanation: "Jésus parle ici à ses disciples, la veille de sa mort. Il leur promet un autre défenseur. Le mot grec employé désigne quelqu'un qu'on appelle à ses côtés dans un procès, un avocat ou un consolateur.",
    catholic: "La tradition catholique lit ici la promesse de l'Esprit. Elle y voit le fondement de la mission de l'Église.",
    orthodox: "La tradition orthodoxe lit ici la promesse de l'Esprit. Elle y voit la source de la vie dans l'Église.",
    action: "Relis la promesse lentement ce soir.",
    divergence_summary: "Les deux traditions lisent ici la promesse de l'Esprit.",
  };

  it("accepts a sober card", () => {
    expect(checkStyle(good).reasons).toEqual([]);
  });

  it("rejects preaching, leaflet formulas and polemics", () => {
    const bad = { ...good, catholic: "Il faut croire que l'Église a raison. En effet, les orthodoxes sont schismatiques et se trompent." };
    const reasons = checkStyle(bad).reasons;
    expect(reasons.some((r) => r.includes("il faut croire"))).toBe(true);
    expect(reasons.some((r) => r.includes("en effet"))).toBe(true);
    expect(reasons.some((r) => r.startsWith("polemic"))).toBe(true);
  });

  it("requires balanced readings when the traditions differ, and a topic", () => {
    const long = { ...good, orthodox: `${good.orthodox} ${"Elle le développe longuement dans sa liturgie et sa prière. ".repeat(4)}` };
    expect(imbalance(long.catholic, long.orthodox)).toBeGreaterThan(MAX_IMBALANCE);
    expect(checkDivergence(long, "differ", "filioque").reasons).toContain("unbalanced_readings");
    expect(checkDivergence(good, "differ", null).reasons).toContain("differ_without_topic");
    expect(checkDivergence({ ...good, orthodox: "La tradition orthodoxe rejette cette lecture. Elle propose autre chose." }, "agree", null).reasons).toContain("agree_but_disagreement_wording");
  });

  it("rejects a named Father or document without a linked verified source", () => {
    expect(checkAttributions("Saint Augustin enseigne que la prière purifie l'âme.", []).reasons).toEqual(["unsourced_attribution:Augustine of Hippo"]);
    expect(checkAttributions("Le Catéchisme le rappelle au paragraphe 2759.", []).reasons).toEqual(["unsourced_attribution:Catechism of the Catholic Church"]);
    expect(checkAttributions("Le concile de Nicée le confesse.", []).reasons).toEqual(["unsourced_attribution:Council"]);
    expect(checkAttributions("Saint Augustin, cité dans la Catena Aurea, le dit.", [{ author: "Augustine of Hippo", work: "Catena Aurea (Thomas Aquinas), Commentary on Matthew", text: null, quote: null }]).reasons).toEqual([]);
    expect(checkAttributions("Une lecture ancienne et courante voit dans ce verset l'annonce du baptême.", []).reasons).toEqual([]);
  });

  it("checks quotes against the source and detects copied runs", () => {
    const source = { author: "Bede", work: "Catena Aurea", text: "This event also, in which the Holy Ghost was seen to come down upon baptism, was a sign of spiritual grace to be given to us in baptism.", quote: "a sign of spiritual grace to be given to us in baptism" };
    expect(checkSourceUse("Bede sees here a sign of grace.", [source]).reasons).toEqual([]);
    expect(checkSourceUse("x", [{ ...source, quote: "a sign of grace that Bede never wrote" }]).reasons).toContain("quote_not_in_source:Bede");
    expect(checkSourceUse("He says the Holy Ghost was seen to come down upon baptism in the river.", [{ ...source, quote: null }]).reasons).toContain("copied_from_source:Bede");
  });

  it("refuses scripture quoted from memory", () => {
    const passage = ["Car Dieu a tant aimé le monde qu'il a donné son Fils unique."];
    expect(checkQuotedScripture("Le texte dit « Dieu a tant aimé le monde ».", passage).reasons).toEqual([]);
    expect(checkQuotedScripture("Le texte dit « Dieu a aimé le monde entier ».", passage).reasons).toHaveLength(1);
    expect(checkQuotedScripture("Le mot « monde » revient.", passage).reasons).toEqual([]);
  });
});
