import { describe, expect, it } from "vitest";
import { AudioCache } from "@/lib/tts/cache";
import { buildSegments, buildUnits, MAX_UNIT_CHARS, speakable, splitSentences, spoken, unitAtFraction } from "@/lib/tts/segment";
import { defaultVoice, isKokoroVoice, VOICE_IDS, validVoice, voicesFor } from "@/lib/tts/voices";

describe("sentence splitting", () => {
  it("splits on sentence ends in French and keeps questions together", () => {
    expect(splitSentences("Tu sais quoi ? Rien. Vraiment rien !", "fr")).toEqual(["Tu sais quoi ?", "Rien.", "Vraiment rien !"]);
  });

  it("does not cut on abbreviations-free decimals or ellipses mid-sentence", () => {
    expect(splitSentences("Il a dit 3.5 fois non. Puis il est parti.", "fr")).toHaveLength(2);
  });

  it("caps long sentences at the maximum size, preferring commas and spaces", () => {
    const long = `${"mot, ".repeat(300)}fin.`;
    const parts = splitSentences(long, "fr");
    expect(parts.length).toBeGreaterThan(2);
    expect(parts.every((p) => p.length <= MAX_UNIT_CHARS)).toBe(true);
    expect(parts.join(" ").replace(/\s+/g, " ")).toBe(long.trim());
  });

  it("returns nothing for blank text", () => {
    expect(splitSentences("  \n ", "en")).toEqual([]);
  });
});

describe("reading units", () => {
  it("orders reference, verses, explanation sentences, label and action", () => {
    const units = buildUnits(
      { reference: "Jean 3, 16-17", verses: ["Car Dieu a tant aimé le monde.", "Dieu n'a pas envoyé son Fils."], plain_explanation: "Phrase un. Phrase deux.", action_step: "Relis ce verset ce soir." },
      "À vivre",
      "fr",
    );
    expect(units.map((u) => `${u.part}:${u.index}`)).toEqual(["title:0", "passage:0", "passage:1", "body:0", "body:1", "label:0", "action:0"]);
    expect(units[3]!.text).toBe("Phrase un.");
  });

  it("never mixes the Bible text and the commentary in one segment (two voices)", () => {
    const units = buildUnits(
      { reference: "Psaume 23, 1-2", verses: ["Cantique de David. L'Éternel est mon berger.", "Il me fait reposer."], plain_explanation: "Un psaume de confiance.", action_step: "Relis-le lentement." },
      "À vivre",
      "fr",
    );
    const segments = buildSegments(units);
    for (const s of segments) expect(new Set(s.units.map((u) => (u.part === "title" || u.part === "passage" ? "scripture" : "commentary"))).size).toBe(1);
    expect(segments[0]!.role).toBe("scripture");
    expect(segments.at(-1)!.role).toBe("commentary");
  });

  it("makes speech text safe for the service", () => {
    expect(speakable("« Salut » <b>toi</b>")).toBe('" Salut " b toi /b');
  });
});

describe("voices", () => {
  it("only accepts allowed voices, per language", () => {
    expect(VOICE_IDS).toContain("fr-FR-RemyMultilingualNeural");
    expect(voicesFor("fr").every((v) => v.id.startsWith("fr-"))).toBe(true);
    expect(voicesFor("en").every((v) => v.id.startsWith("en-"))).toBe(true);
    expect(validVoice("fr", "fr-CA-JeanNeural")).toBe("fr-CA-JeanNeural");
    expect(validVoice("fr", "en-US-AriaNeural")).toBe(defaultVoice("fr"));
    expect(validVoice("en", "nonsense")).toBe(defaultVoice("en"));
    expect(validVoice("en", null)).toBe(defaultVoice("en"));
  });
});

describe("audio cache", () => {
  it("evicts the least recently used entries beyond the byte limit", () => {
    const cache = new AudioCache(10);
    cache.set("a", Buffer.alloc(4));
    cache.set("b", Buffer.alloc(4));
    expect(cache.get("a")).toBeDefined(); // a becomes most recent
    cache.set("c", Buffer.alloc(4));
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBeDefined();
    expect(cache.get("c")).toBeDefined();
    cache.set("huge", Buffer.alloc(11));
    expect(cache.get("huge")).toBeUndefined();
  });
});

describe("audio segments", () => {
  const card = {
    reference: "Matthieu 6, 34",
    verses: [],
    plain_explanation: "Tu as déjà fini un film nul juste parce que tu avais payé la place ? C'est le piège des coûts irrécupérables. L'argent est parti quoi que tu fasses, et la seule vraie question, c'est ce que tu veux faire des deux prochaines heures. Franchement, partir au milieu est souvent la décision la plus lucide de la soirée.",
    action_step: "Choisis un projet ou un abonnement que tu gardes parce que tu as déjà investi et demande-toi si tu le reprendrais à zéro aujourd'hui.",
  };
  const units = buildUnits(card, "À faire aujourd'hui", "fr");

  it("reads a card in a handful of requests instead of one per sentence", () => {
    const segments = buildSegments(units);
    expect(units.length).toBeGreaterThanOrEqual(7);
    expect(segments.length).toBeGreaterThanOrEqual(2);
    expect(segments.length).toBeLessThanOrEqual(5);
    // Every unit is in exactly one segment, in order.
    expect(segments.flatMap((s) => s.units)).toEqual(units);
  });

  it("keeps the first segment short so playback starts fast, and the others bounded", () => {
    const segments = buildSegments(units);
    expect(segments[0]!.text.length).toBeLessThanOrEqual(200);
    for (const s of segments.slice(1)) expect(s.text.length).toBeLessThanOrEqual(520);
  });

  it("never ends a segment on the 'À faire aujourd'hui' label", () => {
    for (const s of buildSegments(units, 60, 80)) expect(s.units[s.units.length - 1]!.part).not.toBe("label");
  });

  it("closes every unit with a stop so the voice's intonation ends properly", () => {
    expect(spoken("Le coût déjà payé")).toBe("Le coût déjà payé.");
    expect(spoken("Tu sais quoi ?")).toBe("Tu sais quoi ?");
    expect(buildSegments(units)[0]!.text).toBe("Matthieu 6, 34.");
  });

  it("finds the sentence being spoken from the playback position", () => {
    const seg = buildSegments(units)[1]!;
    expect(unitAtFraction(seg.units, 0)).toBe(0);
    expect(unitAtFraction(seg.units, 0.999)).toBe(seg.units.length - 1);
    const middle = unitAtFraction(seg.units, 0.5);
    expect(middle).toBeGreaterThan(0);
    expect(middle).toBeLessThan(seg.units.length);
    let previous = -1;
    for (let f = 0; f <= 1; f += 0.05) {
      const index = unitAtFraction(seg.units, f);
      expect(index).toBeGreaterThanOrEqual(previous); // never goes backwards
      previous = index;
    }
    expect(unitAtFraction([seg.units[0]!], 0.7)).toBe(0);
  });
});

describe("local Kokoro voices", () => {
  it("are offered only when the local server is reachable, and become the default", () => {
    expect(voicesFor("fr").some((v) => isKokoroVoice(v.id))).toBe(false);
    expect(voicesFor("fr", true).some((v) => isKokoroVoice(v.id))).toBe(true);
    expect(defaultVoice("fr")).toBe("fr-FR-RemyMultilingualNeural");
    expect(defaultVoice("fr", true)).toBe("kokoro:ff_siwis");
    expect(defaultVoice("en", true)).toBe("kokoro:af_heart");
    expect(validVoice("fr", "kokoro:ff_siwis", false)).toBe("fr-FR-RemyMultilingualNeural");
    expect(validVoice("fr", "kokoro:ff_siwis", true)).toBe("kokoro:ff_siwis");
    expect(VOICE_IDS).toContain("kokoro:am_adam");
  });
});
