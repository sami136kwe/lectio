/**
 * Card generation:
 *
 *   npm run seed:cards                       first lot (Mark 1-2, Psalms 1-5, John 1:1-18, Matthew 16:13-20)
 *   npm run seed:cards -- --all              every chapter of the NT and every psalm
 *   npm run seed:cards -- --book=JHN         one book
 *   npm run seed:cards -- --category=priere  only cards of this main theme
 *   npm run seed:cards -- --dry-run          plan and estimate the cost, no model call
 *   npm run seed:cards -- --resume           continue after an interruption (passages with a card are skipped)
 *   npm run seed:cards -- --extend           new cuts for passages beyond the first coverage, without duplicates
 *   npm run seed:cards -- --lang=en          language of the review sample printed at the end (default fr)
 *   npm run seed:cards -- --yes              do not ask for confirmation (cap still applies)
 *   npm run seed:cards -- --skip-dedup       no embedding service available (dedup by exact range only)
 *
 *   npm run seed:cards -- --last-errors      why passages of the last run were rejected (no model call)
 *   npm run seed:cards -- --local --book=MRK free, on your own machine with Ollama (no API key)
 *
 * --local: model LECTIO_LOCAL_MODEL (default qwen2.5:14b), Ollama at OLLAMA_HOST (default http://127.0.0.1:11434).
 * Otherwise needs ANTHROPIC_API_KEY. Spending cap: MAX_BUDGET_USD (default 10).
 * Writer model: LECTIO_WRITER_MODEL (default claude-sonnet-5-5); checker: LECTIO_CHECKER_MODEL (same default).
 */
import { createInterface } from "node:readline/promises";
import { edgeFunctionEmbedder, type Embedder } from "@/lib/ingestion/embeddings";
import { AnthropicBatchModel, OllamaModel, type PipelineModel } from "@/lib/pipeline/model";
import { runPipeline, type Scope } from "@/lib/pipeline/run";
import { isBookCode } from "@/lib/bible/books";
import { argValue, createServiceClient, hasFlag, type ScriptDb } from "./lib";

async function confirm(estimate: number, passages: number, cap: number): Promise<boolean> {
  if (hasFlag("yes")) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`\n${passages} passages, about $${estimate.toFixed(2)} (cap $${cap.toFixed(2)}). Start? [y/N] `);
  rl.close();
  return /^(y|yes|o|oui)$/i.test(answer.trim());
}

async function printSample(db: ScriptDb, runId: string, language: "fr" | "en") {
  const { data } = await db.from("cards").select("id, status, theology_score").eq("ingestion_run_id", runId);
  const ids = (data ?? []).map((c) => c.id).sort(() => Math.random() - 0.5).slice(0, 15);
  console.log(`\n=== Review sample: ${ids.length} random cards of this run (${language}) ===`);
  for (const id of ids) {
    const [{ data: card }, { data: persp }] = await Promise.all([
      db.from("card_details").select("book_code, chapter_start, verse_start, verse_end, plain_explanation, action_step, status, theology_score").eq("id", id).eq("language", language).single(),
      db.from("card_perspectives").select("tradition, body, divergence_type, divergence_summary, perspective_sources(usage, quote, sources(author, work, section))").eq("card_id", id).eq("language", language),
    ]);
    if (!card) continue;
    console.log(`\n--- ${card.book_code} ${card.chapter_start}:${card.verse_start}-${card.verse_end} · ${card.status} · theology ${card.theology_score ?? "-"}`);
    console.log(`Explanation: ${card.plain_explanation}`);
    for (const p of persp ?? []) {
      console.log(`${p.tradition}: ${p.body}`);
      for (const s of p.perspective_sources as unknown as { usage: string; quote: string | null; sources: { author: string; work: string; section: string } }[]) {
        console.log(`   source (${s.usage}): ${s.sources.author}, ${s.sources.work}, ${s.sources.section}${s.quote ? ` - "${s.quote}"` : ""}`);
      }
    }
    const d = persp?.[0];
    if (d) console.log(`${d.divergence_type}: ${d.divergence_summary}`);
    console.log(`To live: ${card.action_step}`);
  }
  console.log("\nRead these cards before launching the full run (npm run seed:cards -- --all). The admin page shows the same sample with the sources.");
}

async function printErrors(db: ScriptDb, runId?: string) {
  const query = db.from("ingestion_runs").select("id, started_at, scope, status, errors").order("started_at", { ascending: false }).limit(1);
  const { data, error } = runId ? await db.from("ingestion_runs").select("id, started_at, scope, status, errors").eq("id", runId) : await query;
  if (error) throw new Error(error.message);
  const run = data?.[0];
  if (!run) return console.log("No run yet.");
  const errors = (run.errors ?? []) as { scope: string; message: string }[];
  console.log(`\nRun ${run.started_at} (${run.scope}, ${run.status}): ${errors.length} problem(s)`);
  for (const e of errors) console.log(`  - ${e.scope}: ${e.message.slice(0, 400)}`);
}

async function main() {
  const db = createServiceClient();
  if (hasFlag("last-errors")) return printErrors(db);
  const book = argValue("book");
  if (book && !isBookCode(book.toUpperCase())) throw new Error(`unknown book ${book}`);
  const scope: Scope = hasFlag("all") ? { kind: "all" } : book ? { kind: "book", book: book.toUpperCase() } : { kind: "first" };
  const cap = Number(process.env.MAX_BUDGET_USD ?? "10");
  if (!Number.isFinite(cap) || cap <= 0) throw new Error("MAX_BUDGET_USD must be a positive number");
  const dryRun = hasFlag("dry-run");
  const local = hasFlag("local");
  if (!dryRun && !local && !process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set (see .env.example), or use --local (free, with Ollama)");
  let writer: PipelineModel;
  let checker: PipelineModel;
  if (local) {
    const model = new OllamaModel({ model: process.env.LECTIO_LOCAL_MODEL ?? "qwen2.5:14b", host: process.env.OLLAMA_HOST });
    if (!dryRun) await model.probe();
    writer = checker = model;
  } else {
    const writerModel = process.env.LECTIO_WRITER_MODEL ?? "claude-sonnet-5-5";
    writer = new AnthropicBatchModel({ model: writerModel, effort: "high" });
    checker = new AnthropicBatchModel({ model: process.env.LECTIO_CHECKER_MODEL ?? writerModel, effort: "high" });
  }

  let embed: Embedder | null = null;
  if (!hasFlag("skip-dedup") && !dryRun) {
    const secret = process.env.EMBEDDING_FUNCTION_SECRET;
    if (!secret) throw new Error("EMBEDDING_FUNCTION_SECRET is not set (or pass --skip-dedup)");
    embed = edgeFunctionEmbedder(process.env.EMBEDDING_FUNCTION_URL ?? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/embed`, secret, "Lectio-seed/1.0");
    await embed(["probe"]).catch((e: unknown) => {
      throw new Error(`embedding service unavailable (${e instanceof Error ? e.message : String(e)}); fix it or pass --skip-dedup`);
    });
  }
  const summary = await runPipeline(
    {
      db,
      writer,
      checker,
      embed,
      maxBudgetUsd: cap,
      log: (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`),
      confirm: (estimate, passages) => confirm(estimate, passages, cap),
    },
    { scope, source: "seed", chunk: local ? 5 : undefined, extend: hasFlag("extend"), category: argValue("category"), dryRun, limit: argValue("limit") ? Number(argValue("limit")) : undefined },
  );
  console.log(`\n${summary.status}: ${summary.planned} passages · ${summary.published} published · ${summary.drafts} drafts · ${summary.rejected} rejected · $${summary.costUsd.toFixed(2)} spent (estimate $${summary.estimateUsd.toFixed(2)})`);
  if (summary.runId && summary.rejected + summary.drafts > 0) await printErrors(db, summary.runId);
  if (summary.runId && summary.cardIds.length) await printSample(db, summary.runId, argValue("lang") === "en" ? "en" : "fr");
  if (summary.status === "failed") process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
