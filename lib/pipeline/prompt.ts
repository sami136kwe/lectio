/**
 * Prompts and output schemas for card writing and for the theological
 * fidelity check. The Bible text is always given to the model: it never
 * quotes a verse from memory.
 */
import { z } from "zod";
import { DEMO_CARDS } from "@/supabase/seed/demo-cards";

export const DIVERGENCE_TOPICS = ["filioque", "primacy", "marian-dogmas", "purgatory", "theosis", "icons", "sacraments", "other"] as const;

const LangBlock = z.object({
  explanation: z.string().describe("3 to 5 sentences: who speaks, to whom, context, what the text says. No confessional reading."),
  catholic: z.string().describe("3 to 5 sentences: the Catholic reading."),
  orthodox: z.string().describe("3 to 5 sentences: the Orthodox reading."),
  divergence_summary: z.string().describe("One neutral sentence: where the traditions agree or differ."),
  action: z.string().describe("One short concrete suggestion to live or ponder, informal (tu / you)."),
});

export function cardOutputSchema(categorySlugs: readonly [string, ...string[]]) {
  return z.object({
    skip: z.string().nullable().describe("Non-null only if a faithful card cannot be written from the material given; say why."),
    category: z.enum(categorySlugs),
    difficulty: z.number().int().describe("1 accessible, 2 intermediate, 3 in depth"),
    divergence_type: z.enum(["agree", "differ"]),
    divergence_topic: z.enum(DIVERGENCE_TOPICS).nullable(),
    fr: LangBlock,
    en: LangBlock,
    sources_used: z
      .array(
        z.object({
          tradition: z.enum(["catholic", "orthodox"]),
          source_id: z.string(),
          usage: z.enum(["quote", "paraphrase", "reference"]),
          quote: z.string().nullable().describe("Exact words copied from the source (English, under 25 words) when usage is quote; otherwise null."),
        }),
      )
      .describe("Every source a reading relies on or names. Only ids from the SOURCES list."),
  });
}
export type CardOutput = z.infer<ReturnType<typeof cardOutputSchema>>;

export const TheologyOutput = z.object({
  catholic_faithful: z.number().int().describe("1-10: does the Catholic reading reflect what these sources attest and Catholic teaching?"),
  orthodox_faithful: z.number().int().describe("1-10: does the Orthodox reading reflect what these sources attest and Orthodox teaching?"),
  caricature_or_polemic: z.boolean().describe("true if one reading caricatures, criticises or ranks the other tradition"),
  doubtful_facts: z.array(z.string()).describe("Each statement that is doubtful or unsupported, quoted briefly"),
  theology_score: z.number().int().describe("1-10 overall; 8 or more means publishable without correction"),
  comment: z.string(),
});
export type TheologyResult = z.infer<typeof TheologyOutput>;

const example = DEMO_CARDS.find((c) => c.key === "marc-bapteme")!;

export const WRITER_SYSTEM = `You write short Bible study cards for Logion, a reading app for curious or believing people, in French and in English.
Each card is about one passage of the New Testament or the Psalms. You write the commentary only: the Bible text is shown by the app from the database.

ABSOLUTE RULES
1. Never quote Scripture from memory. A quoted phrase of 4 words or more (« … » or "…") must be copied from the PASSAGE texts given (French from the French text, English from the English text). Otherwise paraphrase without quotation marks.
2. Never name a Church Father, saint, council, pope, catechism or document unless a SOURCES entry from that author is attached in sources_used, and say only what that entry says. Quoting the Catena Aurea: write "X, quoted in the Catena Aurea". Without a suitable source, write without names: "the Catholic tradition teaches...", "an ancient and common reading sees...".
3. Direct quotes from a source: under 25 words, copied word for word in English from its text, listed in sources_used with usage "quote". Everything else is reformulated: never copy 8 words in a row from a source.
4. Present each tradition in its own terms, as a well-formed believer of that Church would. Never describe a tradition through criticism of the other. No polemic, no mockery, no judgement on anyone's salvation, no ranking ("the right reading"). Write "the Catholic tradition teaches..." / "the Orthodox tradition confesses...", and say when a point is debated inside a tradition.
5. If the traditions really differ on this passage (Filioque, primacy of Peter, Marian dogmas, purgatory, theosis and grace, icons, sacraments), set divergence_type "differ", the topic, and give each position with equal length (within 30 %), one or two sentences each, without deciding. Otherwise "agree", and the two readings must not contradict each other.
6. Never state a liturgical use (a Sunday, a feast, an office, a tone, a weekday, a cycle): the app shows liturgy from verified data only.
7. No medical, psychological or legal advice, no promise of healing or miracle, no prediction. On passages about Jews, women, slavery or same-sex relations: explain the historical context and how each tradition reads the passage today, soberly. For texts historically misused to justify violence or antisemitism, add one short contextual caution in the explanation.
8. Use each tradition's own vocabulary (theosis, uncreated energies, Divine Liturgy, Orthros, Vespers; Magisterium, Liturgy of the Hours) with a short explanation the first time.

STYLE
Sober and warm, plain language, sentences of varied length. No leaflet formulas ("it is important to", "moreover", "in conclusion", "not only", "crucial", "essential", "fundamental", "il est important de", "en effet", "non seulement", "il faut croire"), no preaching, no moralising, no pressure. French: impersonal or "vous" style in the explanation and readings; the action uses "tu" in French and "you" in English. Each language is written naturally, not translated word for word, with the same meaning and the same sources.

LENGTHS
explanation: 3 to 5 sentences. catholic and orthodox: 3 to 5 sentences each. divergence_summary: 1 sentence. action: 1 or 2 short sentences.
If the material is not enough to write a faithful card, set skip to the reason and fill the other fields with short placeholders.

GOOD EXAMPLE (Mark 1, 9-11; a verified Bede source was attached):
${JSON.stringify({
  category: example.category,
  difficulty: example.difficulty,
  divergence_type: example.divergence.type,
  divergence_topic: null,
  fr: { explanation: example.explanation.fr, catholic: example.catholic.fr, orthodox: example.orthodox.fr, divergence_summary: example.divergence.summary.fr, action: example.action.fr },
  en: { explanation: example.explanation.en, catholic: example.catholic.en, orthodox: example.orthodox.en, divergence_summary: example.divergence.summary.en, action: example.action.en },
  sources_used: [{ tradition: "catholic", source_id: "<id of the Bede entry>", usage: "quote", quote: "a sign of spiritual grace to be given to us in baptism" }],
})}

BAD EXAMPLE (each problem is a reason for rejection):
{"fr":{"explanation":"Il est important de comprendre que ce texte est essentiel.","catholic":"Saint Augustin enseigne dans ses Confessions que...","orthodox":"Contrairement aux catholiques qui se trompent, les orthodoxes...","action":"Vous devez croire que..."}}
Problems: leaflet formulas; Augustine named without an attached source; one tradition described through criticism of the other; pressure on the reader; a reading invented without source.`;

export type PromptSource = { id: string; author: string; work: string; section: string; region: string | null; text: string };

export function writerUserPrompt(input: {
  reference: { fr: string; en: string };
  psalmTitle?: { fr: string; en: string } | null;
  passage: { fr: string; en: string };
  traditionTexts?: { label: string; text: string }[];
  sources: PromptSource[];
  categories: { slug: string; label: string }[];
}): string {
  const lines = [
    `PASSAGE: ${input.reference.fr} / ${input.reference.en}`,
    ...(input.psalmTitle ? [`PSALM NUMBERING: ${input.psalmTitle.fr} / ${input.psalmTitle.en}`] : []),
    "",
    `FRENCH TEXT (Louis Segond 1910):\n${input.passage.fr}`,
    "",
    `ENGLISH TEXT (World English Bible):\n${input.passage.en}`,
    ...(input.traditionTexts ?? []).flatMap((t) => ["", `${t.label}:\n${t.text}`]),
    "",
    "SOURCES (verified extracts; the only ones you may name or quote):",
    ...(input.sources.length
      ? input.sources.map((s) => `[${s.id}] ${s.author}${s.region ? ` (${s.region === "east" ? "Greek/Syriac East" : "Latin West"})` : ""}, ${s.work}, ${s.section}\n${s.text}`)
      : ["(none: write without naming any author or document)"]),
    "",
    "CATEGORIES (choose the best subcategory slug):",
    input.categories.map((c) => `${c.slug} = ${c.label}`).join("; "),
  ];
  return lines.join("\n");
}

export const THEOLOGY_SYSTEM = `You review Bible study cards for theological fidelity, with the sources the writer used in front of you. You know Catholic and Orthodox teaching well and are fair to both.
Answer: does the Catholic reading reflect what these sources attest and Catholic teaching? The Orthodox reading, Orthodox teaching? Does either reading caricature, criticise or rank the other tradition? Is any fact doubtful (a wrong attribution, a wrong date, a teaching presented as universal when it is debated)?
Be strict: 8 or more means a competent theologian of each Church could publish it without correction.`;

export function theologyUserPrompt(card: CardOutput, reference: string, passageEn: string, sources: PromptSource[]): string {
  return [
    `PASSAGE: ${reference}`,
    passageEn,
    "",
    `CATHOLIC READING (en): ${card.en.catholic}`,
    `CATHOLIC READING (fr): ${card.fr.catholic}`,
    `ORTHODOX READING (en): ${card.en.orthodox}`,
    `ORTHODOX READING (fr): ${card.fr.orthodox}`,
    `LABEL: ${card.divergence_type}${card.divergence_topic ? ` (${card.divergence_topic})` : ""} - ${card.en.divergence_summary}`,
    `EXPLANATION (en): ${card.en.explanation}`,
    "",
    "SOURCES USED:",
    ...(sources.length ? sources.map((s) => `${s.author}, ${s.work}, ${s.section}: ${s.text}`) : ["(none)"]),
  ].join("\n");
}
