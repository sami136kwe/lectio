import { NextResponse } from "next/server";
import { jsonError, parseJson, requireApiUser, serverError } from "@/lib/api";
import { recordActivity } from "@/lib/activity";
import { nextMaskLevel } from "@/lib/learn";
import { scheduleReview } from "@/lib/srs/sm2";
import { learnReviewBodySchema } from "@/lib/validation/api";

/** SM-2 step for a verse being learnt; the mask grows when it is remembered. */
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const body = await parseJson(request, learnReviewBodySchema);
  if (!body.ok) return body.response;
  const { supabase, user } = auth;
  const { cardId, rating, day } = body.data;
  const { data: current, error } = await supabase.from("verse_memory").select("interval_days, ease_factor, repetitions, mask_level").eq("user_id", user.id).eq("card_id", cardId).maybeSingle();
  if (error) return serverError("learn:load", error);
  if (!current) return jsonError(404, "not_learning");
  const next = scheduleReview({ intervalDays: current.interval_days, easeFactor: Number(current.ease_factor), repetitions: current.repetitions }, rating);
  const mask = nextMaskLevel(current.mask_level, rating);
  const { error: upError } = await supabase
    .from("verse_memory")
    .update({ rating, interval_days: next.intervalDays, ease_factor: next.easeFactor, repetitions: next.repetitions, next_review_at: next.nextReviewAt.toISOString(), last_reviewed_at: new Date().toISOString(), mask_level: mask })
    .eq("user_id", user.id)
    .eq("card_id", cardId);
  if (upError) return serverError("learn:update", upError);
  await recordActivity(supabase, day);
  return NextResponse.json({ ok: true, maskLevel: mask, intervalDays: next.intervalDays });
}
