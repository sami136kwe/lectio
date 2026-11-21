/**
 * Rule-based checks on a Lectio card (no model involved). Used by the
 * generation pipeline before publication, by check:db and by the tests on the
 * hand-written cards.
 */
import { longestCommonWordRun } from "@/lib/ingestion/similarity";
import { normalizeText, splitSentences, tokenize, wordCount } from "@/lib/ingestion/text";

export type Language = "fr" | "en";
export type CheckResult = { ok: boolean; reasons: string[] };

const fold = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[’`]/g, "'").toLowerCase();

// ---------------------------------------------------------------------------
// Style: sober and warm, no leaflet formulas, no preaching, no pressure.
// ---------------------------------------------------------------------------
export const BANNED: Record<Language, RegExp[]> = {
  fr: [
    /\bil est important de\b/,
    /\bil est essentiel de\b/,
    /\ben effet\b/,
    /\bpar ailleurs\b/,
    /\ben conclusion\b/,
    /\bdans un monde ou\b/,
    /\bnon seulement\b/,
    /\ben somme\b/,
    /\bil faut croire\b/,
    /\bnous devons tous\b/,
    /\bil faut absolument\b/,
    /\bn'oublions jamais\b/,
    /\bplus que jamais\b/,
    /\bcrucia(l|le|ux|les)\b/,
    /\bfondamenta(l|le|ux|les)\b/,
    /\bincontournable(s)?\b/,
  ],
  en: [
    /\bit is important to\b/,
    /\bit's important to\b/,
    /\bmoreover\b/,
    /\bfurthermore\b/,
    /\bin conclusion\b/,
    /\bin a world where\b/,
    /\bnot only\b/,
    /\badditionally\b/,
    /\bwe must all\b/,
    /\byou must believe\b/,
    /\bnow more than ever\b/,
    /\bcrucial\b/,
    /\bfundamental(ly)?\b/,
    /\bpivotal\b/,
    /\bdelve\b/,
  ],
};

/** Polemical or dismissive vocabulary about another tradition or group. */
export const POLEMIC: Record<Language, RegExp[]> = {
  fr: [/\bheresie(s)?\b/, /\bheretique(s)?\b/, /\bschismatique(s)?\b/, /\bpapiste(s)?\b/, /\bla vraie eglise\b/, /\bla bonne lecture\b/, /\bse trompe(nt)?\b/, /\bdeicide\b/],
  en: [/\bheres(y|ies)\b/, /\bheretic(s|al)?\b/, /\bschismatic(s)?\b/, /\bpapist(s)?\b/, /\bthe true church\b/, /\bthe right reading\b/, /\b(are|is) wrong\b/, /\bdeicide\b/],
};

export function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 1;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (mean === 0) return 0;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length) / mean;
}

export type CardText = {
  language: Language;
  explanation: string;
  catholic: string;
  orthodox: string;
  action: string;
  divergence_summary?: string | null;
};

export function checkStyle(card: CardText): CheckResult {
  const reasons: string[] = [];
  const all = fold(`${card.explanation} ${card.catholic} ${card.orthodox} ${card.action} ${card.divergence_summary ?? ""}`);
  for (const re of BANNED[card.language]) if (re.test(all)) reasons.push(`banned:${re.source}`);
  for (const re of POLEMIC[card.language]) if (re.test(all)) reasons.push(`polemic:${re.source}`);

  const sentences = splitSentences(card.explanation);
  if (sentences.length < 3 || sentences.length > 6) reasons.push(`explanation_sentences:${sentences.length}`);
  if (sentences.length >= 3 && coefficientOfVariation(sentences.map(wordCount)) < 0.15) reasons.push("uniform_sentence_length");
  for (const [name, text] of [["catholic", card.catholic], ["orthodox", card.orthodox]] as const) {
    const n = splitSentences(text).length;
    if (n < 2 || n > 6) reasons.push(`${name}_sentences:${n}`);
  }
  const openers = new Map<string, number>();
  const ARTICLES = new Set(["the", "a", "an", "le", "la", "les", "l", "un", "une", "des"]);
  for (const s of sentences) {
    const w = tokenize(s)[0];
    if (w && !ARTICLES.has(w)) openers.set(w, (openers.get(w) ?? 0) + 1);
  }
  for (const [w, c] of openers) if (c > 2) reasons.push(`repeated_opener:${w}`);
  if ((`${card.explanation}${card.catholic}${card.orthodox}`.match(/—/g) ?? []).length > 1) reasons.push("em_dash_series");
  if (wordCount(card.action) > 45) reasons.push("action_too_long");
  return { ok: reasons.length === 0, reasons };
}

// ---------------------------------------------------------------------------
// Balance and divergence label
// ---------------------------------------------------------------------------
export const MAX_IMBALANCE = 0.3;

/** Relative length difference between the two readings (0 = equal). */
export function imbalance(a: string, b: string): number {
  const x = a.length;
  const y = b.length;
  return Math.abs(x - y) / Math.max(x, y, 1);
}

const DISAGREEMENT: Record<Language, RegExp> = {
  fr: /\b(rejette|refuse|ne re[cç]oit pas|n'accepte pas|conteste|diverge(nt)?|au contraire de|contrairement a)\b/,
  en: /\b(rejects?|refuses?|does not accept|do not accept|disputes?|diverge|unlike the)\b/,
};

export function checkDivergence(card: CardText, type: "agree" | "differ" | "none", topic: string | null | undefined): CheckResult {
  const reasons: string[] = [];
  if (type === "differ") {
    if (!topic) reasons.push("differ_without_topic");
    if (imbalance(card.catholic, card.orthodox) > MAX_IMBALANCE) reasons.push("unbalanced_readings");
  }
  if (type === "agree") {
    const both = fold(`${card.catholic} ${card.orthodox}`);
    if (DISAGREEMENT[card.language].test(both)) reasons.push("agree_but_disagreement_wording");
  }
  if (type !== "none" && !card.divergence_summary) reasons.push("missing_divergence_summary");
  return { ok: reasons.length === 0, reasons };
}

// ---------------------------------------------------------------------------
// Attributions: a named Father, council or document needs a linked verified source.
// ---------------------------------------------------------------------------

/** Names (folded, French and English) of authorities that require a source, mapped to the author name used in `sources`. */
export const AUTHORITIES: [RegExp, string][] = [
  [/\baugustin(e)?\b/, "Augustine of Hippo"],
  [/\bchrysostom(e)?\b/, "John Chrysostom"],
  [/\bcyrill?e? d'alexandrie\b|\bcyril of alexandria\b/, "Cyril of Alexandria"],
  [/\bambroise\b|\bambrose\b/, "Ambrose of Milan"],
  [/\bjerome\b/, "Jerome"],
  [/\bbede\b/, "Bede"],
  [/\btheophylacte?\b|\btheophylact\b/, "Theophylact of Ohrid"],
  [/\bgregoire de nysse\b|\bgregory of nyssa\b/, "Gregory of Nyssa"],
  [/\bgregoire de nazianze\b|\bgregory (of )?nazianzus\b|\bgregory the theologian\b/, "Gregory of Nazianzus"],
  [/\bgregoire le grand\b|\bgregory the great\b|\bgregory the dialogist\b/, "Gregory the Dialogist"],
  [/\bbasile\b|\bbasil\b/, "Basil of Caesarea"],
  [/\bathanase\b|\bathanasius\b/, "Athanasius of Alexandria"],
  [/\birenee\b|\birenaeus\b/, "Irenaeus"],
  [/\borigene\b|\borigen\b/, "Origen of Alexandria"],
  [/\bleon le grand\b|\bleo the great\b/, "Leo the Great"],
  [/\bhilaire\b|\bhilary\b/, "Hilary of Poitiers"],
  [/\btertullien\b|\btertullian\b/, "Tertullian"],
  [/\bcyprien\b|\bcyprian\b/, "Cyprian"],
  [/\bephrem\b/, "Ephrem the Syrian"],
  [/\bmaxime le confesseur\b|\bmaximus the confessor\b/, "Maximus the Confessor"],
  [/\bjean damascene\b|\bjohn of damascus\b|\bjohn damascene\b/, "John of Damascus"],
  [/\bpalamas\b/, "Gregory Palamas"],
  [/\bthomas d'aquin\b|\bthomas aquinas\b|\baquinas\b/, "Thomas Aquinas"],
  [/\bcatechisme\b|\bcatechism\b/, "Catechism of the Catholic Church"],
  [/\bvatican (i|ii|1|2)\b|\bconcile du vatican\b|\bvatican council\b/, "Vatican Council"],
  [/\b(concile|council) (de |of )?(nicee|nicaea|nicea|constantinople|ephese|ephesus|chalcedoine|chalcedon|trente|trent|florence|lyon)\b/, "Council"],
  [/\bencyclique\b|\bencyclical\b|\blumen gentium\b|\bdei verbum\b|\bineffabilis deus\b|\bpastor aeternus\b/, "Magisterial document"],
];

/** "Catena Aurea" names the compilation that quotes a Father: allowed when a Catena source is linked. */
const CATENA = /\bcatena aurea\b/;

export type LinkedSource = { author: string; work: string; text: string | null; quote: string | null };

export function checkAttributions(text: string, linked: LinkedSource[]): CheckResult {
  const reasons: string[] = [];
  const t = fold(text);
  const authors = new Set(linked.map((l) => l.author));
  for (const [re, author] of AUTHORITIES) {
    if (!re.test(t)) continue;
    if (author === "Thomas Aquinas" && CATENA.test(t) && linked.some((l) => l.work.startsWith("Catena Aurea"))) continue;
    if (!authors.has(author)) reasons.push(`unsourced_attribution:${author}`);
  }
  if (CATENA.test(t) && !linked.some((l) => l.work.startsWith("Catena Aurea"))) reasons.push("unsourced_attribution:Catena Aurea");
  return { ok: reasons.length === 0, reasons };
}

export const MAX_QUOTE_WORDS = 25;
export const MAX_COPIED_WORDS = 8;

/** Quotes must be short and found word for word; the rest of the text must not copy a source. */
export function checkSourceUse(text: string, linked: LinkedSource[]): CheckResult {
  const reasons: string[] = [];
  for (const l of linked) {
    if (l.quote) {
      if (wordCount(l.quote) >= MAX_QUOTE_WORDS) reasons.push(`quote_too_long:${l.author}`);
      if (!l.text || !normalizeText(l.text).includes(normalizeText(l.quote))) reasons.push(`quote_not_in_source:${l.author}`);
    }
  }
  let rest = text;
  for (const l of linked) if (l.quote) rest = rest.split(l.quote).join(" ");
  for (const l of linked) {
    if (l.text && longestCommonWordRun(rest, l.text) >= MAX_COPIED_WORDS) reasons.push(`copied_from_source:${l.author}`);
  }
  return { ok: reasons.length === 0, reasons };
}

/**
 * Quoted phrases of 4 words or more (« … », “…”, "…") must come from the
 * passage text given to the writer: no verse is quoted from memory.
 */
export function checkQuotedScripture(text: string, passageTexts: string[], allowed: string[] = []): CheckResult {
  const reasons: string[] = [];
  const pool = normalizeText([...passageTexts, ...allowed].join(" "));
  const quoted = [...text.matchAll(/«\s*([^»]+?)\s*»|“([^”]+)”|"([^"]+)"/g)].map((m) => m[1] ?? m[2] ?? m[3] ?? "");
  for (const q of quoted) {
    if (wordCount(q) < 4) continue;
    if (!pool.includes(normalizeText(q))) reasons.push(`quote_not_in_passage:${q.slice(0, 40)}`);
  }
  return { ok: reasons.length === 0, reasons };
}

export function merge(...results: CheckResult[]): CheckResult {
  const reasons = results.flatMap((r) => r.reasons);
  return { ok: reasons.length === 0, reasons };
}
