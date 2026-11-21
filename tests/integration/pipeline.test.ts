/**
 * The whole generation pipeline against the real database, with fake models
 * (no API call, no cost): planning, context, checks, storing, run log.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database";
import type { BatchRequest, BatchResult, PipelineModel } from "@/lib/pipeline/model";
import type { CardOutput } from "@/lib/pipeline/prompt";
import { planPassages, runPipeline } from "@/lib/pipeline/run";
import type { z } from "zod";

config({ path: ".env.local" });
const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const lang = (fr: boolean) => ({
  explanation: fr
    ? "Paul écrit depuis sa prison à Philémon, un chrétien de Colosses. Il intercède pour Onésime. Cet esclave s'était enfui et il est devenu chrétien auprès de l'apôtre, qui le renvoie avec cette lettre."
    : "Paul writes from prison to Philemon, a Christian of Colossae. He pleads for Onesimus. This enslaved man had run away and became a Christian with the apostle, who sends him back with this letter.",
  catholic: fr ? "La tradition catholique lit ici la charité qui transforme les relations. Elle y voit une fraternité nouvelle dans le Christ." : "The Catholic tradition reads here the charity that transforms relationships. It sees a new brotherhood in Christ.",
  orthodox: fr ? "La tradition orthodoxe lit ici la communion qui renouvelle les relations. Elle y voit la fraternité vécue dans l'Église." : "The Orthodox tradition reads here the communion that renews relationships. It sees brotherhood lived in the Church.",
  divergence_summary: fr ? "Les deux traditions lisent ici une fraternité nouvelle." : "Both traditions read a new brotherhood here.",
  action: fr ? "Écris un mot de réconciliation à quelqu'un aujourd'hui." : "Write a word of reconciliation to someone today.",
});

class FakeWriter implements PipelineModel {
  readonly name = "fake-writer";
  calls = 0;
  async run<T>(requests: BatchRequest[], schema: z.ZodType<T>): Promise<BatchResult<T>[]> {
    this.calls += requests.length;
    return requests.map((r, i) => {
      const out: CardOutput = {
        skip: null,
        category: "amour-du-prochain",
        difficulty: 1,
        divergence_type: "agree",
        divergence_topic: null,
        fr: { ...lang(true), explanation: `${lang(true).explanation} Passage ${i + 1}.` },
        en: { ...lang(false), explanation: `${lang(false).explanation} Passage ${i + 1}.` },
        sources_used: [],
      };
      // The second passage names a Father without a source: must be rejected by the checks.
      if (i === 1) out.fr = { ...out.fr, catholic: "Saint Augustin enseigne ici la charité. Il y voit la fraternité." };
      const parsed = schema.safeParse(out);
      return parsed.success ? { id: r.id, ok: true as const, value: parsed.data, costUsd: 0.01 } : { id: r.id, ok: false as const, error: "schema", costUsd: 0 };
    });
  }
}

class FakeChecker implements PipelineModel {
  readonly name = "fake-checker";
  constructor(private score: number) {}
  async run<T>(requests: BatchRequest[], schema: z.ZodType<T>): Promise<BatchResult<T>[]> {
    return requests.map((r) => {
      const v = schema.parse({ catholic_faithful: this.score, orthodox_faithful: this.score, caricature_or_polemic: false, doubtful_facts: [], theology_score: this.score, comment: "" });
      return { id: r.id, ok: true as const, value: v, costUsd: 0.005 };
    });
  }
}

const runs: string[] = [];
afterAll(async () => {
  for (const id of runs) {
    await db.from("cards").delete().eq("ingestion_run_id", id);
    await db.from("ingestion_runs").delete().eq("id", id);
  }
});

describe("generation pipeline (fake models)", () => {
  it("plans the whole of Philemon without gaps", async () => {
    const plan = await planPassages(db, { kind: "book", book: "PHM" });
    expect(plan.length).toBeGreaterThanOrEqual(4);
    expect(plan[0]).toMatchObject({ chapterStart: 1, verseStart: 1 });
    expect(plan.at(-1)!.verseEnd).toBe(25);
    for (let i = 1; i < plan.length; i++) expect(plan[i]!.verseStart).toBe(plan[i - 1]!.verseEnd + 1);
  });

  it("writes, checks and stores cards; rejects an unsourced attribution; keeps low theology scores as drafts", async () => {
    const writer = new FakeWriter();
    const summary = await runPipeline(
      { db, writer, checker: new FakeChecker(9), embed: null, maxBudgetUsd: 5, log: () => undefined, confirm: async () => true },
      { scope: { kind: "book", book: "PHM" }, source: "seed", limit: 3 },
    );
    runs.push(summary.runId!);
    expect(summary.planned).toBe(3);
    expect(summary.published).toBe(2);
    expect(summary.rejected).toBe(1);
    const { data: run } = await db.from("ingestion_runs").select("status, cards_created, cards_rejected, cost_usd, errors").eq("id", summary.runId!).single();
    expect(run).toMatchObject({ status: "partial", cards_created: 2, cards_rejected: 1 });
    expect(JSON.stringify(run!.errors)).toContain("unsourced_attribution:Augustine of Hippo");
    const { data: persp } = await db.from("card_perspectives").select("review_status, cards!inner(ingestion_run_id)").eq("cards.ingestion_run_id", summary.runId!);
    expect(persp!.length).toBe(8);
    expect(persp!.every((p) => p.review_status === "unreviewed")).toBe(true);

    // Same scope again: passages that now have a card are skipped (no duplicates).
    const again = await runPipeline(
      { db, writer: new FakeWriter(), checker: new FakeChecker(6), embed: null, maxBudgetUsd: 5, log: () => undefined, confirm: async () => true },
      { scope: { kind: "book", book: "PHM" }, source: "seed", limit: 1 },
    );
    runs.push(again.runId!);
    const { data: first } = await db.from("cards").select("passage_id").eq("ingestion_run_id", summary.runId!);
    const { data: second } = await db.from("cards").select("passage_id, status").eq("ingestion_run_id", again.runId!);
    expect(second!.every((c) => !first!.some((f) => f.passage_id === c.passage_id))).toBe(true);
    expect(second!.every((c) => c.status === "draft")).toBe(true); // theology score 6 < 8
  });

  it("stops before spending more than the cap", async () => {
    const summary = await runPipeline(
      { db, writer: new FakeWriter(), checker: new FakeChecker(9), embed: null, maxBudgetUsd: 0.0001, log: () => undefined, confirm: async () => true },
      { scope: { kind: "book", book: "PHM" }, source: "seed", limit: 1 },
    );
    if (summary.runId) runs.push(summary.runId);
    expect(summary.status).toBe("partial");
    expect(summary.published + summary.drafts).toBe(0);
  });

  it("does nothing when the cost is not confirmed", async () => {
    const writer = new FakeWriter();
    const summary = await runPipeline(
      { db, writer, checker: new FakeChecker(9), embed: null, maxBudgetUsd: 5, log: () => undefined, confirm: async () => false },
      { scope: { kind: "book", book: "PHM" }, source: "seed", limit: 1 },
    );
    expect(summary.status).toBe("cancelled");
    expect(writer.calls).toBe(0);
  });
});
