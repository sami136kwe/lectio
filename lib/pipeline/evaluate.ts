/**
 * Turns one model answer into a publishable card, or a list of reasons why
 * not. Pure: every input (passage texts, sources) is passed in.
 */
import { checkAttributions, checkDivergence, checkQuotedScripture, checkSourceUse, checkStyle, merge, type CardText, type LinkedSource } from "@/lib/content/checks";
import type { CardOutput } from "./prompt";

export type EvalSource = { id: string; author: string; work: string; text: string };

export type EvalContext = {
  /** Every text of the passage the writer saw (FR and EN, tradition texts). */
  passageTexts: string[];
  sources: EvalSource[];
  categorySlugs: string[];
};

export type Evaluation = { ok: boolean; reasons: string[] };

export function cardText(out: CardOutput, language: "fr" | "en"): CardText {
  const l = out[language];
  return { language, explanation: l.explanation, catholic: l.catholic, orthodox: l.orthodox, action: l.action, divergence_summary: l.divergence_summary };
}

export function linkedFor(out: CardOutput, tradition: "catholic" | "orthodox", sources: EvalSource[]): LinkedSource[] {
  const byId = new Map(sources.map((s) => [s.id, s]));
  return out.sources_used
    .filter((u) => u.tradition === tradition && byId.has(u.source_id))
    .map((u) => ({ ...byId.get(u.source_id)!, quote: u.usage === "quote" ? u.quote : null }));
}

export function evaluateCard(out: CardOutput, ctx: EvalContext): Evaluation {
  const reasons: string[] = [];
  if (out.skip) return { ok: false, reasons: [`model_skipped:${out.skip.slice(0, 120)}`] };
  if (!ctx.categorySlugs.includes(out.category)) reasons.push(`unknown_category:${out.category}`);
  if (![1, 2, 3].includes(out.difficulty)) reasons.push(`bad_difficulty:${out.difficulty}`);
  const known = new Set(ctx.sources.map((s) => s.id));
  for (const u of out.sources_used) {
    if (!known.has(u.source_id)) reasons.push(`unknown_source:${u.source_id}`);
    if (u.usage === "quote" && !u.quote) reasons.push(`quote_missing:${u.source_id}`);
  }
  for (const language of ["fr", "en"] as const) {
    const text = cardText(out, language);
    const results = [
      checkStyle(text),
      checkDivergence(text, out.divergence_type, out.divergence_topic),
      checkAttributions(text.explanation, []),
      checkAttributions(`${text.action} ${text.divergence_summary ?? ""}`, []),
      checkQuotedScripture(`${text.explanation} ${text.catholic} ${text.orthodox} ${text.action}`, ctx.passageTexts),
    ];
    for (const tradition of ["catholic", "orthodox"] as const) {
      const linked = linkedFor(out, tradition, ctx.sources);
      results.push(checkAttributions(text[tradition], linked), checkSourceUse(text[tradition], linked));
    }
    reasons.push(...merge(...results).reasons.map((r) => `${language}:${r}`));
  }
  return { ok: reasons.length === 0, reasons: [...new Set(reasons)] };
}

export const THEOLOGY_THRESHOLD = 8;
