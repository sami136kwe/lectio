/**
 * Model access for the pipeline: Message Batches (half price), structured
 * JSON outputs validated with Zod, a spending cap, and cost estimates.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

export type BatchRequest = { id: string; system: string; user: string; maxTokens: number };
export type BatchResult<T> = { id: string; ok: true; value: T; costUsd: number } | { id: string; ok: false; error: string; costUsd: number };

export interface PipelineModel {
  readonly name: string;
  run<T>(requests: BatchRequest[], schema: z.ZodType<T>, onProgress?: (message: string) => void): Promise<BatchResult<T>[]>;
}

/** USD per million tokens, standard rates (batches cost half). */
export const PRICES: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};
export const BATCH_DISCOUNT = 0.5;

export function priceOf(model: string) {
  return PRICES[model] ?? PRICES["claude-opus-5-5"]!;
}

type Usage = { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null };

export function usageCost(model: string, u: Usage): number {
  const p = priceOf(model);
  const input = u.input_tokens + (u.cache_creation_input_tokens ?? 0) * 1.25 + (u.cache_read_input_tokens ?? 0) * 0.1;
  return ((input * p.input + u.output_tokens * p.output) / 1_000_000) * BATCH_DISCOUNT;
}

/** Rough estimate before running: about 3.5 characters per token; output tokens include thinking. */
export function estimateCost(model: string, requests: { system: string; user: string }[], outputTokensPerRequest: number): number {
  const p = priceOf(model);
  let input = 0;
  for (const r of requests) input += (r.system.length + r.user.length) / 3.5;
  return ((input * p.input + requests.length * outputTokensPerRequest * p.output) / 1_000_000) * BATCH_DISCOUNT;
}

export class AnthropicBatchModel implements PipelineModel {
  readonly name: string;
  private client: Anthropic;

  constructor(
    private options: { apiKey?: string; model: string; effort: "low" | "medium" | "high"; pollSeconds?: number },
  ) {
    this.client = new Anthropic(options.apiKey ? { apiKey: options.apiKey } : {});
    this.name = options.model;
  }

  async run<T>(requests: BatchRequest[], schema: z.ZodType<T>, onProgress?: (message: string) => void): Promise<BatchResult<T>[]> {
    if (requests.length === 0) return [];
    const format = zodOutputFormat(schema as z.ZodType);
    const batch = await this.client.messages.batches.create({
      requests: requests.map((r) => ({
        custom_id: r.id,
        params: {
          model: this.options.model,
          max_tokens: r.maxTokens,
          system: [{ type: "text", text: r.system, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: r.user }],
          output_config: { effort: this.options.effort, format: { type: "json_schema", schema: format.schema } },
        },
      })),
    });
    onProgress?.(`batch ${batch.id} submitted (${requests.length} requests)`);
    let status = batch;
    while (status.processing_status !== "ended") {
      await new Promise((r) => setTimeout(r, (this.options.pollSeconds ?? 30) * 1000));
      status = await this.client.messages.batches.retrieve(batch.id);
      const c = status.request_counts;
      onProgress?.(`batch ${batch.id}: ${c.succeeded} ok, ${c.errored} errors, ${c.processing} running`);
    }
    const out: BatchResult<T>[] = [];
    for await (const item of await this.client.messages.batches.results(batch.id)) {
      if (item.result.type !== "succeeded") {
        out.push({ id: item.custom_id, ok: false, error: item.result.type, costUsd: 0 });
        continue;
      }
      const message = item.result.message;
      const costUsd = usageCost(this.options.model, message.usage);
      if (message.stop_reason === "refusal") {
        out.push({ id: item.custom_id, ok: false, error: `refusal:${message.stop_details?.category ?? "unknown"}`, costUsd });
        continue;
      }
      if (message.stop_reason === "max_tokens") {
        out.push({ id: item.custom_id, ok: false, error: "max_tokens", costUsd });
        continue;
      }
      const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
      try {
        const parsed = schema.safeParse(JSON.parse(text));
        out.push(parsed.success ? { id: item.custom_id, ok: true, value: parsed.data, costUsd } : { id: item.custom_id, ok: false, error: "schema", costUsd });
      } catch {
        out.push({ id: item.custom_id, ok: false, error: "invalid_json", costUsd });
      }
    }
    return out;
  }
}

export class BudgetExceededError extends Error {
  constructor(spent: number, cap: number) {
    super(`spending cap reached: $${spent.toFixed(2)} of $${cap.toFixed(2)}`);
    this.name = "BudgetExceededError";
  }
}
