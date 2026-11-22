import { describe, expect, it } from "vitest";
import { z } from "zod";
import { estimateCost, OllamaModel } from "@/lib/pipeline/model";

const schema = z.object({ answer: z.string() });

function fakeFetch(replies: unknown[], calls: unknown[] = []): typeof fetch {
  return (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
    const reply = replies.shift();
    if (reply instanceof Error) throw reply;
    return new Response(JSON.stringify(reply), { status: 200 });
  }) as unknown as typeof fetch;
}

describe("OllamaModel", () => {
  it("sends the system and user prompts with the JSON schema and parses the answer", async () => {
    const calls: { url: string; body: { model: string; format: unknown; messages: { role: string }[] } }[] = [];
    const m = new OllamaModel({ model: "qwen2.5:14b", fetch: fakeFetch([{ message: { content: '{"answer":"ok"}' }, done_reason: "stop" }], calls) });
    const [r] = await m.run([{ id: "a", system: "S", user: "U", maxTokens: 100 }], schema);
    expect(r).toEqual({ id: "a", ok: true, value: { answer: "ok" }, costUsd: 0 });
    expect(calls[0]!.url).toBe("http://127.0.0.1:11434/api/chat");
    expect(calls[0]!.body.model).toBe("qwen2.5:14b");
    expect(calls[0]!.body.messages.map((x) => x.role)).toEqual(["system", "user"]);
    expect(calls[0]!.body.format).toMatchObject({ type: "object" });
  });

  it("reports truncation, bad JSON, schema errors and network errors without throwing", async () => {
    const m = new OllamaModel({
      model: "x",
      fetch: fakeFetch([
        { message: { content: "{" }, done_reason: "length" },
        { message: { content: "not json" }, done_reason: "stop" },
        { message: { content: '{"other":1}' }, done_reason: "stop" },
        new Error("ECONNREFUSED"),
      ]),
    });
    const out = await m.run(["1", "2", "3", "4"].map((id) => ({ id, system: "", user: "", maxTokens: 10 })), schema);
    expect(out.map((o) => (o.ok ? "ok" : o.error))).toEqual(["max_tokens", "invalid_json", "schema", "ECONNREFUSED"]);
  });

  it("is free", () => {
    expect(estimateCost("ollama:qwen2.5:14b", [{ system: "x".repeat(10000), user: "y" }], 4000)).toBe(0);
  });

  it("explains how to start Ollama or download the model", async () => {
    await expect(new OllamaModel({ model: "m", fetch: fakeFetch([new Error("down")]) }).probe()).rejects.toThrow(/Ollama is not running/);
    await expect(new OllamaModel({ model: "qwen2.5:14b", fetch: fakeFetch([{ models: [{ name: "llama3:latest" }] }]) }).probe()).rejects.toThrow(/ollama pull qwen2.5:14b/);
    await expect(new OllamaModel({ model: "qwen2.5:14b", fetch: fakeFetch([{ models: [{ name: "qwen2.5:14b" }] }]) }).probe()).resolves.toBeUndefined();
  });
});
