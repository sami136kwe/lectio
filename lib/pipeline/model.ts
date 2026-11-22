/**
 * Model access for the pipeline: Message Batches (half price), structured
 * JSON outputs validated with Zod, a spending cap, and cost estimates.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

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
  if (model.startsWith("ollama:")) return { input: 0, output: 0 }; // runs on your own machine
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

/**
 * Free, local model through Ollama (https://ollama.com), one request at a time.
 * Same prompts, same JSON schema and the same checks as the batch model; the
 * cost is zero. Structured output uses Ollama's `format` (JSON schema).
 */
export class OllamaModel implements PipelineModel {
  readonly name: string;

  constructor(
    private options: { model: string; host?: string; contextTokens?: number; fetch?: typeof fetch },
  ) {
    this.name = `ollama:${options.model}`;
  }

  private get host() {
    return (this.options.host ?? "http://127.0.0.1:11434").replace(/\/$/, "");
  }

  /** Throws a readable error if Ollama is not running or the model is not downloaded. */
  async probe(): Promise<void> {
    const f = this.options.fetch ?? fetch;
    let res: Response;
    try {
      res = await f(`${this.host}/api/tags`);
    } catch {
      throw new Error(`Ollama is not running at ${this.host}: open the Ollama app (or run \`ollama serve\`)`);
    }
    const tags = (await res.json()) as { models?: { name: string }[] };
    const names = (tags.models ?? []).map((m) => m.name);
    const wanted = this.options.model.includes(":") ? this.options.model : `${this.options.model}:latest`;
    if (!names.includes(wanted)) throw new Error(`model ${this.options.model} is not downloaded: run \`ollama pull ${this.options.model}\``);
  }

  async run<T>(requests: BatchRequest[], schema: z.ZodType<T>, onProgress?: (message: string) => void): Promise<BatchResult<T>[]> {
    const f = this.options.fetch ?? fetch;
    const format = z.toJSONSchema(schema as z.ZodType);
    const out: BatchResult<T>[] = [];
    for (const [i, r] of requests.entries()) {
      try {
        const res = await f(`${this.host}/api/chat`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model: this.options.model,
            // Streamed: a slow machine can take minutes per card, and fetch gives up
            // after 5 minutes without response headers or data.
            stream: true,
            format,
            messages: [
              { role: "system", content: r.system },
              { role: "user", content: r.user },
            ],
            options: { temperature: 0.3, num_predict: r.maxTokens, num_ctx: this.options.contextTokens ?? 16384 },
          }),
        });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const { content, doneReason } = await readStream(res.body);
        if (doneReason === "length") {
          out.push({ id: r.id, ok: false, error: "max_tokens", costUsd: 0 });
        } else {
          const parsed = schema.safeParse(JSON.parse(content));
          out.push(
            parsed.success
              ? { id: r.id, ok: true, value: parsed.data, costUsd: 0 }
              : { id: r.id, ok: false, error: `schema:${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`, costUsd: 0 },
          );
        }
      } catch (e) {
        out.push({ id: r.id, ok: false, error: e instanceof SyntaxError ? "invalid_json" : e instanceof Error ? e.message : String(e), costUsd: 0 });
      }
      onProgress?.(`${this.name}: ${i + 1}/${requests.length}`);
    }
    return out;
  }
}

/** Reads Ollama's streamed answer (one JSON object per line). */
async function readStream(body: ReadableStream<Uint8Array>): Promise<{ content: string; doneReason?: string }> {
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let doneReason: string | undefined;
  const take = (line: string) => {
    if (!line.trim()) return;
    const chunk = JSON.parse(line) as { message?: { content?: string }; done?: boolean; done_reason?: string; error?: string };
    if (chunk.error) throw new Error(`ollama: ${chunk.error}`);
    content += chunk.message?.content ?? "";
    if (chunk.done) doneReason = chunk.done_reason;
  };
  for await (const part of body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(part, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(take);
  }
  take(buffer);
  return { content, doneReason };
}

export class BudgetExceededError extends Error {
  constructor(spent: number, cap: number) {
    super(`spending cap reached: $${spent.toFixed(2)} of $${cap.toFixed(2)}`);
    this.name = "BudgetExceededError";
  }
}
