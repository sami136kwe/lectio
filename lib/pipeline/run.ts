/**
 * Card generation pipeline:
 *   passages (deterministic cuts) -> context (exact texts + verified sources)
 *   -> writing batch -> rule checks -> deduplication -> theology batch
 *   -> storing (published when every check passes and theology_score >= 8,
 *      draft otherwise), every run logged in ingestion_runs.
 */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { BOOKS, book as bookInfo, sortKey } from "@/lib/bible/books";
import { passageTextHash, referenceText, textWithFallback, type PassageText } from "@/lib/bible/passage";
import { lxxLabelForRange, psalmTitle, TITLE_VERSES } from "@/lib/bible/psalms";
import { formatReference, verseKey, type Range } from "@/lib/bible/reference";
import { toVectorLiteral, type Embedder } from "@/lib/ingestion/embeddings";
import { evaluateCard, THEOLOGY_THRESHOLD, type EvalSource } from "./evaluate";
import { BudgetExceededError, estimateCost, type PipelineModel } from "./model";
import { cardOutputSchema, THEOLOGY_SYSTEM, TheologyOutput, theologyUserPrompt, WRITER_SYSTEM, writerUserPrompt, type CardOutput, type PromptSource } from "./prompt";
import { segmentChapter, validateCoverage } from "./segment";

export type Db = SupabaseClient<Database>;

export const DUPLICATE_SIMILARITY = 0.9;
const MAX_SOURCES_PER_TRADITION = 4;
const SOURCE_CHARS = 1400;
export const WRITER_MAX_TOKENS = 16000;
export const THEOLOGY_MAX_TOKENS = 6000;
/** Expected output tokens (thinking included) for the cost estimate. */
const EST_WRITER_OUTPUT = 4000;
const EST_THEOLOGY_OUTPUT = 1500;

// ---------------------------------------------------------------------------
// Scope and passages
// ---------------------------------------------------------------------------
export type Scope = { kind: "first" } | { kind: "all" } | { kind: "book"; book: string };

/** The first lot: Mark 1-2, Psalms 1-5, John 1:1-18, and Matthew 16:13-20 (a known point of divergence). */
export const FIRST_LOT: { book: string; chapter: number; from?: number; to?: number }[] = [
  { book: "MRK", chapter: 1 },
  { book: "MRK", chapter: 2 },
  ...[1, 2, 3, 4, 5].map((chapter) => ({ book: "PSA", chapter })),
  { book: "JHN", chapter: 1, from: 1, to: 18 },
  { book: "MAT", chapter: 16, from: 13, to: 20 },
];

export function chaptersOf(scope: Scope): { book: string; chapter: number; from?: number; to?: number }[] {
  if (scope.kind === "first") return FIRST_LOT;
  const books = scope.kind === "book" ? [bookInfo(scope.book)] : BOOKS;
  return books.flatMap((b) => Array.from({ length: b.chapters }, (_, i) => ({ book: b.code, chapter: i + 1 })));
}

export async function upsertPassage(db: Db, r: Range): Promise<string> {
  const isPsalm = r.book === "PSA";
  const row = {
    book_code: r.book,
    chapter_start: r.chapterStart,
    verse_start: r.verseStart,
    chapter_end: r.chapterEnd,
    verse_end: r.verseEnd,
    psalm_number_hebrew: isPsalm && r.chapterStart <= 150 ? r.chapterStart : null,
    psalm_number_lxx: isPsalm ? (r.chapterStart === 151 ? "151" : lxxLabelForRange(r.chapterStart, r.verseStart, r.verseEnd)) : null,
    sort_key: sortKey(r.book, r.chapterStart, r.verseStart),
  };
  const { data, error } = await db.from("passages").upsert(row, { onConflict: "book_code,chapter_start,verse_start,chapter_end,verse_end" }).select("id").single();
  if (error) throw new Error(`passage: ${error.message}`);
  return data.id;
}

/** Seasons of a passage, from the verified liturgical uses that cover it. */
export async function seasonsFor(db: Db, r: Range): Promise<string[]> {
  const { data, error } = await db
    .from("liturgical_uses")
    .select("season_id, chapter_start, verse_start, chapter_end, verse_end")
    .eq("book_code", r.book)
    .lte("chapter_start", r.chapterEnd)
    .gte("chapter_end", r.chapterStart)
    .eq("verified", true)
    .not("season_id", "is", null);
  if (error) throw new Error(error.message);
  const start = r.chapterStart * 1000 + r.verseStart;
  const end = r.chapterEnd * 1000 + r.verseEnd;
  return [...new Set(data.filter((u) => u.chapter_start * 1000 + u.verse_start <= end && u.chapter_end * 1000 + u.verse_end >= start).map((u) => u.season_id!))];
}

export type PlannedPassage = Range & { id: string };

/**
 * Cuts every chapter of the scope and returns the passages still without a
 * card. A passage overlapping an existing card is skipped (no duplicates),
 * except with `extend`, which cuts with an offset and only skips identical ranges.
 */
export async function planPassages(db: Db, scope: Scope, opts: { extend?: boolean; limit?: number } = {}): Promise<PlannedPassage[]> {
  const { data: lsg, error } = await db.from("bible_versions").select("id").eq("code", "LSG1910").single();
  if (error) throw new Error("import the Bible first (npm run import:bible)");
  const { data: carded, error: cError } = await db.from("cards").select("status, passages!inner(book_code, chapter_start, verse_start, chapter_end, verse_end)").neq("status", "rejected");
  if (cError) throw new Error(cError.message);
  const existing = (carded as unknown as { passages: { book_code: string; chapter_start: number; verse_start: number; chapter_end: number; verse_end: number } }[]).map((c) => c.passages);
  const out: PlannedPassage[] = [];
  for (const ch of chaptersOf(scope)) {
    const { data: verses, error: vError } = await db.from("bible_verses").select("verse, text").eq("version_id", lsg.id).eq("book_code", ch.book).eq("chapter", ch.chapter).order("verse");
    if (vError) throw new Error(vError.message);
    const inScope = verses.filter((v) => (ch.from === undefined || v.verse >= ch.from) && (ch.to === undefined || v.verse <= ch.to));
    const segments = segmentChapter(inScope, { psalm: ch.book === "PSA", titleVerses: ch.book === "PSA" && !ch.from ? TITLE_VERSES[ch.chapter - 1] : 0, offset: opts.extend ? 2 : 0 });
    const errors = validateCoverage(inScope, segments);
    if (errors.length) throw new Error(`${ch.book} ${ch.chapter}: ${errors.join(", ")}`);
    for (const s of segments) {
      const r: Range = { book: ch.book, chapterStart: ch.chapter, verseStart: s.start, chapterEnd: ch.chapter, verseEnd: s.end };
      const same = (e: (typeof existing)[number]) => e.book_code === r.book && e.chapter_start === r.chapterStart && e.verse_start === r.verseStart && e.chapter_end === r.chapterEnd && e.verse_end === r.verseEnd;
      const overlaps = (e: (typeof existing)[number]) =>
        e.book_code === r.book && e.chapter_start * 1000 + e.verse_start <= r.chapterEnd * 1000 + r.verseEnd && e.chapter_end * 1000 + e.verse_end >= r.chapterStart * 1000 + r.verseStart;
      if (existing.some(opts.extend ? same : overlaps)) continue;
      out.push({ ...r, id: await upsertPassage(db, r) });
      if (opts.limit && out.length >= opts.limit) return out;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Context: exact texts and verified sources
// ---------------------------------------------------------------------------
export type PassageContext = {
  passage: PlannedPassage;
  reference: { fr: string; en: string };
  psalmTitle: { fr: string; en: string } | null;
  texts: { fr: PassageText; en: PassageText; extra: PassageText[] };
  sources: PromptSource[];
  textHash: string;
};

const joinVerses = (t: PassageText) => t.verses.map((v) => `${v.verse} ${v.text}`).join("\n");

export async function buildContext(db: Db, p: PlannedPassage): Promise<PassageContext> {
  const ref = await referenceText(db, p);
  const fr = (await textWithFallback(db, ["LSG1910"], p, ref)) ?? ref;
  const en = (await textWithFallback(db, ["WEB", "KJV"], p, ref)) ?? ref;
  const extra: PassageText[] = [];
  if (p.book === "PSA") {
    for (const code of ["DRC", "BRENTON_LXX", "GIGUET_LXX"]) {
      const t = await textWithFallback(db, [code], p, ref);
      if (t) extra.push(t);
    }
  }
  const keys: string[] = [];
  for (let c = p.chapterStart; c <= p.chapterEnd; c++) {
    for (let v = c === p.chapterStart ? p.verseStart : 1; v <= (c === p.chapterEnd ? p.verseEnd : 200); v++) keys.push(verseKey(p.book, c, v));
  }
  const { data, error } = await db
    .from("sources")
    .select("id, author, work, section, region, tradition, text")
    .eq("verified", true)
    .eq("kind", "patristic")
    .overlaps("bible_refs", keys)
    .limit(60);
  if (error) throw new Error(error.message);
  type Row = NonNullable<typeof data>[number];
  const rows: Row[] = data ?? [];
  const pick = (pred: (s: Row) => boolean) =>
    rows
      .filter(pred)
      .sort((a, b) => (a.text?.length ?? 0) - (b.text?.length ?? 0))
      .slice(0, MAX_SOURCES_PER_TRADITION);
  const chosen = new Map<string, Row>();
  for (const s of [...pick((s) => s.region === "east"), ...pick((s) => s.region !== "east")]) chosen.set(s.id, s);
  const isPsalm = p.book === "PSA";
  return {
    passage: p,
    reference: { fr: formatReference(p, "fr"), en: formatReference(p, "en") },
    psalmTitle: isPsalm
      ? {
          fr: psalmTitle(p.chapterStart <= 150 ? p.chapterStart : null, p.chapterStart <= 150 ? lxxLabelForRange(p.chapterStart, p.verseStart, p.verseEnd) : "151", "fr"),
          en: psalmTitle(p.chapterStart <= 150 ? p.chapterStart : null, p.chapterStart <= 150 ? lxxLabelForRange(p.chapterStart, p.verseStart, p.verseEnd) : "151", "en"),
        }
      : null,
    texts: { fr, en, extra },
    sources: [...chosen.values()].map((s) => ({ id: s.id, author: s.author, work: s.work, section: s.section, region: s.region, text: (s.text ?? "").slice(0, SOURCE_CHARS) })),
    textHash: passageTextHash(ref),
  };
}

export function writerRequest(ctx: PassageContext, categories: { slug: string; label: string }[]) {
  return {
    id: ctx.passage.id,
    system: WRITER_SYSTEM,
    maxTokens: WRITER_MAX_TOKENS,
    user: writerUserPrompt({
      reference: ctx.reference,
      psalmTitle: ctx.psalmTitle,
      passage: { fr: joinVerses(ctx.texts.fr), en: joinVerses(ctx.texts.en) },
      traditionTexts: ctx.texts.extra.map((t) => ({ label: `${t.versionName} (${t.language})`, text: joinVerses(t) })),
      sources: ctx.sources,
      categories,
    }),
  };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
export type PipelineDeps = {
  db: Db;
  writer: PipelineModel;
  checker: PipelineModel;
  embed: Embedder | null;
  maxBudgetUsd: number;
  log: (message: string) => void;
  /** Called once with the cost estimate; resolves false to cancel. */
  confirm: (estimateUsd: number, passages: number) => Promise<boolean>;
};

export type RunOptions = { scope: Scope; source: "seed" | "admin"; extend?: boolean; limit?: number; category?: string; dryRun?: boolean; chunk?: number };

export type RunSummary = { runId: string | null; planned: number; published: number; drafts: number; rejected: number; costUsd: number; estimateUsd: number; status: string; cardIds: string[] };

async function categoriesFor(db: Db, mainSlug?: string) {
  const { data, error } = await db.from("categories").select("id, slug, name_en, parent_id");
  if (error) throw new Error(error.message);
  const main = mainSlug ? data.find((c) => c.slug === mainSlug && !c.parent_id) : null;
  if (mainSlug && !main) throw new Error(`unknown main category ${mainSlug}`);
  const subs = data.filter((c) => c.parent_id && (!main || c.parent_id === main.id));
  return { list: subs.map((c) => ({ slug: c.slug, label: c.name_en })), idBySlug: new Map(subs.map((c) => [c.slug, c.id])) };
}

function contentHash(out: CardOutput): string {
  return createHash("sha256").update(`${out.fr.explanation}\n${out.en.explanation}\n${out.fr.catholic}\n${out.fr.orthodox}`).digest("hex");
}

async function isDuplicate(db: Db, embed: Embedder, out: CardOutput): Promise<{ duplicate: boolean; vectors: Record<string, string> }> {
  const texts = [out.fr.explanation, out.en.explanation, out.fr.catholic, out.en.catholic, out.fr.orthodox, out.en.orthodox];
  const v = (await embed(texts)).map(toVectorLiteral);
  const vectors = { frExp: v[0]!, enExp: v[1]!, frCat: v[2]!, enCat: v[3]!, frOrth: v[4]!, enOrth: v[5]! };
  const checks = await Promise.all([
    db.rpc("match_translations", { query_embedding: vectors.frExp, match_language: "fr", match_threshold: DUPLICATE_SIMILARITY, match_count: 1 }),
    db.rpc("match_translations", { query_embedding: vectors.enExp, match_language: "en", match_threshold: DUPLICATE_SIMILARITY, match_count: 1 }),
    db.rpc("match_perspectives", { query_embedding: vectors.frCat, match_language: "fr", match_tradition: "catholic", match_threshold: DUPLICATE_SIMILARITY, match_count: 1 }),
    db.rpc("match_perspectives", { query_embedding: vectors.frOrth, match_language: "fr", match_tradition: "orthodox", match_threshold: DUPLICATE_SIMILARITY, match_count: 1 }),
  ]);
  for (const c of checks) if (c.error) throw new Error(c.error.message);
  return { duplicate: checks.some((c) => (c.data ?? []).length > 0), vectors };
}

async function storeCard(
  db: Db,
  ctx: PassageContext,
  out: CardOutput,
  status: "published" | "draft",
  scores: { theology: number | null },
  categoryId: string,
  runId: string,
  vectors: Record<string, string> | null,
): Promise<string> {
  const { data: card, error } = await db
    .from("cards")
    .insert({
      passage_id: ctx.passage.id,
      category_id: categoryId,
      difficulty: out.difficulty,
      status,
      quality_score: null,
      theology_score: scores.theology,
      content_hash: contentHash(out),
      passage_text_hash: ctx.textHash,
      source_type: "pipeline",
      ingestion_run_id: runId,
    })
    .select("id")
    .single();
  if (error) throw new Error(`card: ${error.message}`);
  const { error: tError } = await db.from("card_translations").insert(
    (["fr", "en"] as const).map((language) => ({
      card_id: card.id,
      language,
      plain_explanation: out[language].explanation,
      action_step: out[language].action,
      // Rule-based style score: cards reach this point only when no style rule is broken.
      style_score: 10,
      status,
      embedding: vectors ? vectors[language === "fr" ? "frExp" : "enExp"] : null,
    })),
  );
  if (tError) throw new Error(`translations: ${tError.message}`);
  for (const tradition of ["catholic", "orthodox"] as const) {
    for (const language of ["fr", "en"] as const) {
      const { data: p, error: pError } = await db
        .from("card_perspectives")
        .insert({
          card_id: card.id,
          language,
          tradition,
          body: out[language][tradition],
          divergence_type: out.divergence_type,
          divergence_topic: out.divergence_type === "differ" ? out.divergence_topic : null,
          divergence_summary: out[language].divergence_summary,
          review_status: "unreviewed",
          embedding: vectors ? vectors[`${language}${tradition === "catholic" ? "Cat" : "Orth"}`] : null,
        })
        .select("id")
        .single();
      if (pError) throw new Error(`perspective: ${pError.message}`);
      const links = out.sources_used.filter((u) => u.tradition === tradition);
      if (links.length) {
        const unique = new Map(links.map((u) => [u.source_id, u]));
        const { error: lError } = await db
          .from("perspective_sources")
          .insert([...unique.values()].map((u) => ({ perspective_id: p.id, source_id: u.source_id, usage: u.usage, quote: u.usage === "quote" ? u.quote : null })));
        if (lError) throw new Error(`sources: ${lError.message}`);
      }
    }
  }
  const seasons = await seasonsFor(db, ctx.passage);
  if (seasons.length) await db.from("card_seasons").insert(seasons.map((season_id) => ({ card_id: card.id, season_id })));
  return card.id;
}

export async function runPipeline(deps: PipelineDeps, opts: RunOptions): Promise<RunSummary> {
  const { db, log } = deps;
  const categories = await categoriesFor(db, opts.category);
  const slugs = categories.list.map((c) => c.slug) as [string, ...string[]];
  const schema = cardOutputSchema(slugs);
  const planned = await planPassages(db, opts.scope, { extend: opts.extend, limit: opts.limit });
  log(`${planned.length} passages to write`);
  const summary: RunSummary = { runId: null, planned: planned.length, published: 0, drafts: 0, rejected: 0, costUsd: 0, estimateUsd: 0, status: "success", cardIds: [] };
  if (planned.length === 0) return summary;

  const contexts: PassageContext[] = [];
  for (const p of planned) contexts.push(await buildContext(db, p));
  const writerRequests = contexts.map((c) => writerRequest(c, categories.list));
  summary.estimateUsd =
    estimateCost(deps.writer.name, writerRequests, EST_WRITER_OUTPUT) +
    estimateCost(deps.checker.name, writerRequests.map((r) => ({ system: THEOLOGY_SYSTEM, user: r.user.slice(0, 6000) })), EST_THEOLOGY_OUTPUT);
  log(`estimated cost: $${summary.estimateUsd.toFixed(2)} (writer ${deps.writer.name}, checker ${deps.checker.name}, batch prices); cap MAX_BUDGET_USD = $${deps.maxBudgetUsd}`);
  if (opts.dryRun) {
    summary.status = "dry_run";
    return summary;
  }
  if (!(await deps.confirm(summary.estimateUsd, planned.length))) {
    summary.status = "cancelled";
    return summary;
  }

  const scopeLabel = opts.scope.kind === "book" ? `book:${opts.scope.book}` : opts.scope.kind;
  const { data: run, error: runError } = await db.from("ingestion_runs").insert({ source: opts.source, scope: scopeLabel }).select("id").single();
  if (runError) throw new Error(runError.message);
  summary.runId = run.id;
  const errors: { at: string; scope: string; message: string }[] = [];
  const note = (scope: string, message: string) => errors.push({ at: new Date().toISOString(), scope, message });
  let modelCalls = 0;

  const chunk = opts.chunk ?? 100;
  try {
    for (let i = 0; i < contexts.length; i += chunk) {
      const slice = contexts.slice(i, i + chunk);
      const left = deps.maxBudgetUsd - summary.costUsd;
      const sliceEstimate = (summary.estimateUsd * slice.length) / contexts.length;
      if (sliceEstimate > left) throw new BudgetExceededError(summary.costUsd + sliceEstimate, deps.maxBudgetUsd);

      // 1. Writing
      const written = await deps.writer.run(slice.map((c) => writerRequest(c, categories.list)), schema, log);
      modelCalls += slice.length;
      summary.costUsd += written.reduce((s, r) => s + r.costUsd, 0);
      const candidates: { ctx: PassageContext; out: CardOutput; vectors: Record<string, string> | null }[] = [];
      for (const r of written) {
        const ctx = slice.find((c) => c.passage.id === r.id)!;
        if (!r.ok) {
          summary.rejected += 1;
          note(ctx.reference.en, `writer:${r.error}`);
          continue;
        }
        // 2. Rule checks
        const evalSources: EvalSource[] = ctx.sources.map((s) => ({ id: s.id, author: s.author, work: s.work, text: s.text }));
        const passageTexts = [ctx.texts.fr, ctx.texts.en, ...ctx.texts.extra].map((t) => t.verses.map((v) => v.text).join(" "));
        const verdict = evaluateCard(r.value, { passageTexts, sources: evalSources, categorySlugs: slugs });
        if (!verdict.ok) {
          summary.rejected += 1;
          note(ctx.reference.en, `checks:${verdict.reasons.join(",")}`);
          continue;
        }
        // 3. Deduplication
        let vectors: Record<string, string> | null = null;
        if (deps.embed) {
          const d = await isDuplicate(db, deps.embed, r.value);
          if (d.duplicate) {
            summary.rejected += 1;
            note(ctx.reference.en, "duplicate");
            continue;
          }
          vectors = d.vectors;
        }
        candidates.push({ ctx, out: r.value, vectors });
      }

      // 4. Theological fidelity (second model call, with the sources)
      const checked = await deps.checker.run(
        candidates.map((c) => ({
          id: c.ctx.passage.id,
          system: THEOLOGY_SYSTEM,
          maxTokens: THEOLOGY_MAX_TOKENS,
          user: theologyUserPrompt(
            c.out,
            c.ctx.reference.en,
            joinVerses(c.ctx.texts.en),
            c.out.sources_used.map((u) => c.ctx.sources.find((s) => s.id === u.source_id)).filter((s): s is PromptSource => !!s),
          ),
        })),
        TheologyOutput,
        log,
      );
      modelCalls += candidates.length;
      summary.costUsd += checked.reduce((s, r) => s + r.costUsd, 0);

      // 5. Storing
      for (const c of candidates) {
        const t = checked.find((x) => x.id === c.ctx.passage.id);
        const score = t?.ok ? Math.min(t.value.theology_score, t.value.catholic_faithful, t.value.orthodox_faithful) : null;
        const clean = !!t?.ok && !t.value.caricature_or_polemic && t.value.doubtful_facts.length === 0;
        const status = score !== null && score >= THEOLOGY_THRESHOLD && clean ? "published" : "draft";
        if (t && !t.ok) note(c.ctx.reference.en, `theology:${t.error}`);
        if (t?.ok && status === "draft") note(c.ctx.reference.en, `theology_draft:${score}:${t.value.doubtful_facts.slice(0, 2).join(" | ")}`);
        try {
          const id = await storeCard(db, c.ctx, c.out, status, { theology: score }, categories.idBySlug.get(c.out.category)!, run.id, c.vectors);
          summary.cardIds.push(id);
          if (status === "published") summary.published += 1;
          else summary.drafts += 1;
        } catch (e) {
          summary.rejected += 1;
          note(c.ctx.reference.en, `store:${e instanceof Error ? e.message : String(e)}`);
        }
      }
      log(`progress: ${Math.min(i + chunk, contexts.length)}/${contexts.length} · published ${summary.published} · drafts ${summary.drafts} · rejected ${summary.rejected} · $${summary.costUsd.toFixed(2)}`);
      await db
        .from("ingestion_runs")
        .update({ cards_created: summary.published + summary.drafts, cards_rejected: summary.rejected, model_calls: modelCalls, cost_usd: summary.costUsd, errors, details: { planned: planned.length, done: Math.min(i + chunk, contexts.length) } })
        .eq("id", run.id);
    }
  } catch (e) {
    summary.status = e instanceof BudgetExceededError ? "partial" : "failed";
    note("run", e instanceof Error ? e.message : String(e));
    log(`stopped: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (summary.status === "success" && summary.rejected > 0) summary.status = "partial";
  await db
    .from("ingestion_runs")
    .update({
      finished_at: new Date().toISOString(),
      status: summary.status === "success" ? "success" : summary.status === "partial" ? "partial" : "failed",
      cards_created: summary.published + summary.drafts,
      cards_rejected: summary.rejected,
      model_calls: modelCalls,
      cost_usd: summary.costUsd,
      errors,
    })
    .eq("id", run.id);
  return summary;
}
