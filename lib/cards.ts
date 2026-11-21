import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { referenceText, textWithFallback, type PassageText } from "@/lib/bible/passage";
import { psalmTitle } from "@/lib/bible/psalms";
import { formatReference, type Range } from "@/lib/bible/reference";

type Db = SupabaseClient<Database>;
export type CardDetails = Database["public"]["Views"]["card_details"]["Row"];
export type CardLanguage = "fr" | "en";
export type TraditionCode = "catholic" | "orthodox";

export const CARD_FIELDS =
  "id, passage_id, book_code, chapter_start, verse_start, chapter_end, verse_end, psalm_number_hebrew, psalm_number_lxx, sort_key, category_id, main_category_id, category_slug, category_name_fr, category_name_en, category_icon, plain_explanation, action_step, key_words, difficulty, language" as const;

export type CardRow = Pick<
  CardDetails,
  | "id"
  | "passage_id"
  | "book_code"
  | "chapter_start"
  | "verse_start"
  | "chapter_end"
  | "verse_end"
  | "psalm_number_hebrew"
  | "psalm_number_lxx"
  | "sort_key"
  | "category_id"
  | "main_category_id"
  | "category_slug"
  | "category_name_fr"
  | "category_name_en"
  | "category_icon"
  | "plain_explanation"
  | "action_step"
  | "key_words"
  | "difficulty"
  | "language"
>;

export type SourceRef = { author: string; work: string; section: string; url: string; usage: "quote" | "paraphrase" | "reference"; quote: string | null };

export type Perspective = {
  tradition: TraditionCode;
  body: string;
  divergence_type: "agree" | "differ" | "none";
  divergence_summary: string | null;
  divergence_topic: string | null;
  review_status: "unreviewed" | "reviewed" | "corrected" | "rejected";
  sources: SourceRef[];
};

export type LiturgicalUse = {
  tradition: TraditionCode;
  rite: "roman" | "byzantine";
  occasion_type: string;
  description: string;
  calendar: "gregorian" | "julian" | "revised_julian" | "none";
  source: { author: string; work: string; section: string; url: string } | null;
};

export type KeyWord = { lemma: string; transliteration: string; gloss: string; source_id?: string };

export type CardSummary = CardRow & {
  reference: string;
  /** "Psaume 23 (22 dans la Septante)" for psalms, null otherwise. */
  psalm_title: string | null;
  /** Text in the reader's version (neutral reading). */
  passage: PassageText | null;
  /** For psalms: the text attached to each tradition (Vulgate, Septuagint). */
  tradition_texts: Record<TraditionCode, PassageText | null>;
  greek: PassageText | null;
  perspectives: Perspective[];
  liturgy: LiturgicalUse[];
};

export type ReadingPrefs = { bible_version_fr: string; bible_version_en: string; show_greek: boolean };
const DEFAULT_PREFS: ReadingPrefs = { bible_version_fr: "LSG1910", bible_version_en: "WEB", show_greek: false };

export function cardRange(c: Pick<CardRow, "book_code" | "chapter_start" | "verse_start" | "chapter_end" | "verse_end">): Range {
  return { book: c.book_code!, chapterStart: c.chapter_start!, verseStart: c.verse_start!, chapterEnd: c.chapter_end!, verseEnd: c.verse_end! };
}

/** Version fallback lists, by reading language. */
export function versionPlan(language: CardLanguage, prefs: ReadingPrefs, isPsalm: boolean) {
  const neutral = language === "fr" ? [prefs.bible_version_fr, "LSG1910"] : [prefs.bible_version_en, "WEB", "KJV"];
  return {
    neutral: [...new Set(neutral)],
    // No free French translation of the Vulgate is available: the English Douay-Rheims is shown, with a notice.
    catholic: isPsalm ? ["DRC"] : [],
    orthodox: isPsalm ? (language === "fr" ? ["GIGUET_LXX", "BRENTON_LXX"] : ["BRENTON_LXX"]) : [],
  };
}

async function readingPrefs(db: Db): Promise<ReadingPrefs> {
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return DEFAULT_PREFS;
  const { data } = await db.from("profiles").select("bible_version_fr, bible_version_en, show_greek").eq("id", auth.user.id).maybeSingle();
  return data ?? DEFAULT_PREFS;
}

type PerspectiveRow = {
  card_id: string;
  tradition: string;
  body: string;
  divergence_type: string;
  divergence_summary: string | null;
  divergence_topic: string | null;
  review_status: string;
  perspective_sources: { usage: string; quote: string | null; sources: { author: string; work: string; section: string; url: string } | null }[];
};

async function perspectivesFor(db: Db, ids: string[], language: CardLanguage): Promise<Map<string, Perspective[]>> {
  const out = new Map<string, Perspective[]>();
  if (ids.length === 0) return out;
  const { data, error } = await db
    .from("card_perspectives")
    .select("card_id, tradition, body, divergence_type, divergence_summary, divergence_topic, review_status, perspective_sources(usage, quote, sources(author, work, section, url))")
    .in("card_id", ids)
    .eq("language", language)
    .in("tradition", ["catholic", "orthodox"]);
  if (error) throw new Error(error.message);
  for (const p of data as unknown as PerspectiveRow[]) {
    const list = out.get(p.card_id) ?? [];
    list.push({
      tradition: p.tradition as TraditionCode,
      body: p.body,
      divergence_type: p.divergence_type as Perspective["divergence_type"],
      divergence_summary: p.divergence_summary,
      divergence_topic: p.divergence_topic,
      review_status: p.review_status as Perspective["review_status"],
      sources: p.perspective_sources
        .filter((s) => s.sources)
        .map((s) => ({ ...s.sources!, usage: s.usage as SourceRef["usage"], quote: s.quote })),
    });
    out.set(p.card_id, list.sort((a, b) => a.tradition.localeCompare(b.tradition)));
  }
  return out;
}

async function liturgyFor(db: Db, r: Range, language: CardLanguage): Promise<LiturgicalUse[]> {
  const { data, error } = await db
    .from("liturgical_uses")
    .select("tradition, rite, occasion_type, description_fr, description_en, calendar, chapter_start, verse_start, chapter_end, verse_end, sources(author, work, section, url)")
    .eq("book_code", r.book)
    .lte("chapter_start", r.chapterEnd)
    .gte("chapter_end", r.chapterStart)
    .eq("verified", true);
  if (error) throw new Error(error.message);
  const start = r.chapterStart * 1000 + r.verseStart;
  const end = r.chapterEnd * 1000 + r.verseEnd;
  const uses = data
    .filter((u) => u.chapter_start * 1000 + u.verse_start <= end && u.chapter_end * 1000 + u.verse_end >= start)
    .map((u) => ({
      tradition: u.tradition as TraditionCode,
      rite: u.rite as LiturgicalUse["rite"],
      occasion_type: u.occasion_type,
      description: language === "fr" ? u.description_fr : u.description_en,
      calendar: u.calendar as LiturgicalUse["calendar"],
      source: (u.sources as unknown as LiturgicalUse["source"]) ?? null,
    }));
  return selectLiturgy(uses);
}

/**
 * At most MAX_USES per tradition, without duplicates (a responsorial psalm
 * is cited in several segments). Dated Byzantine readings keep the next
 * occurrences first, Sundays before weekdays.
 */
export const MAX_USES = 3;
export function selectLiturgy(uses: LiturgicalUse[], today: string = new Date().toISOString().slice(0, 10)): LiturgicalUse[] {
  const seen = new Set<string>();
  const unique = uses.filter((u) => !seen.has(u.description) && seen.add(u.description));
  const dateOf = (u: LiturgicalUse) => /(\d{1,2}) (\S+) (\d{4})/.exec(u.description);
  const isoOf = (u: LiturgicalUse): string | null => {
    const m = dateOf(u);
    if (!m) return null;
    const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
    const monthsEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const mi = Math.max(months.indexOf(m[2]!), monthsEn.indexOf(m[2]!));
    return mi < 0 ? null : `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  };
  const rank = (u: LiturgicalUse) => {
    const iso = isoOf(u);
    if (!iso) return [0, ""] as const;
    const sunday = /dimanche|Sunday/.test(u.description) ? 0 : 1;
    return [iso >= today ? 1 + sunday : 3 + sunday, iso] as const;
  };
  const out: LiturgicalUse[] = [];
  for (const tradition of ["catholic", "orthodox"] as const) {
    const list = unique
      .filter((u) => u.tradition === tradition)
      .sort((a, b) => {
        const [ra, da] = rank(a);
        const [rb, db] = rank(b);
        return ra - rb || da.localeCompare(db);
      });
    out.push(...list.slice(0, MAX_USES));
  }
  return out;
}

/** Adds the passage text, the readings and the liturgy to card rows. */
export async function assembleCards(db: Db, rowsIn: CardRow[], language: CardLanguage, prefs?: ReadingPrefs): Promise<CardSummary[]> {
  const p = prefs ?? (await readingPrefs(db));
  const perspectives = await perspectivesFor(db, rowsIn.map((c) => c.id!), language);
  return Promise.all(
    rowsIn.map(async (c) => {
      const r = cardRange(c);
      const isPsalm = r.book === "PSA";
      const plan = versionPlan(language, p, isPsalm);
      const reference = await referenceText(db, r);
      const [passage, catholic, orthodox, greek, liturgy] = await Promise.all([
        textWithFallback(db, plan.neutral, r, reference).then((t) => t ?? reference),
        plan.catholic.length ? textWithFallback(db, plan.catholic, r, reference) : Promise.resolve(null),
        plan.orthodox.length ? textWithFallback(db, plan.orthodox, r, reference) : Promise.resolve(null),
        p.show_greek && !isPsalm ? textWithFallback(db, ["BYZANTINE_GREEK"], r, reference) : Promise.resolve(null),
        liturgyFor(db, r, language),
      ]);
      return {
        ...c,
        reference: formatReference(r, language),
        psalm_title: isPsalm ? psalmTitle(c.psalm_number_hebrew, c.psalm_number_lxx, language) : null,
        passage,
        tradition_texts: { catholic, orthodox },
        greek,
        perspectives: perspectives.get(c.id!) ?? [],
        liturgy,
      };
    }),
  );
}

/** Loads published cards by id, in one language, in the order of `ids`. */
export async function cardsByIds(db: Db, ids: string[], language: CardLanguage, prefs?: ReadingPrefs): Promise<CardSummary[]> {
  if (ids.length === 0) return [];
  const { data, error } = await db.from("card_details").select(CARD_FIELDS).in("id", ids).eq("language", language).eq("status", "published");
  if (error) throw new Error(error.message);
  const byId = new Map(data.map((c) => [c.id, c]));
  const ordered = ids.map((id) => byId.get(id)).filter((c): c is CardRow => !!c);
  return assembleCards(db, ordered, language, prefs);
}

/** One published card in `language`, falling back to its other language when missing. */
export async function cardById(db: Db, id: string, language: CardLanguage): Promise<CardSummary | null> {
  const { data, error } = await db.from("card_details").select(CARD_FIELDS).eq("id", id).eq("status", "published");
  if (error) throw new Error(error.message);
  const row = data.find((c) => c.language === language) ?? data[0];
  if (!row) return null;
  const [card] = await assembleCards(db, [row], row.language === "en" ? "en" : "fr");
  return card ?? null;
}

/** Both versions of a card, for the "flip to the other language" button. */
export async function cardVersions(db: Db, id: string): Promise<Partial<Record<CardLanguage, CardSummary>>> {
  const out: Partial<Record<CardLanguage, CardSummary>> = {};
  for (const lang of ["fr", "en"] as const) {
    const [card] = await cardsByIds(db, [id], lang);
    if (card) out[lang] = card;
  }
  return out;
}
