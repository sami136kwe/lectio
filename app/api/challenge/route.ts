import { NextResponse } from "next/server";
import { parseJson, parseQuery, requireApiUser, serverError } from "@/lib/api";
import { recordActivity } from "@/lib/activity";
import { cardsByIds, type CardSummary } from "@/lib/cards";
import { challengeBodySchema, challengeQuerySchema } from "@/lib/validation/api";

function dayBounds(day: string, offsetMinutes: number) {
  // Client local midnight expressed in UTC.
  const start = new Date(`${day}T00:00:00Z`).getTime() + offsetMinutes * 60_000;
  return { start: new Date(start).toISOString(), end: new Date(start + 86_400_000).toISOString() };
}

function offsetFrom(request: Request): number {
  const raw = Number(new URL(request.url).searchParams.get("tz") ?? 0);
  return Number.isFinite(raw) && Math.abs(raw) <= 14 * 60 ? Math.round(raw) : 0;
}

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const query = parseQuery(request, challengeQuerySchema);
  if (!query.ok) return query.response;
  const { supabase, user } = auth;

  const { data, error } = await supabase.rpc("daily_challenge", { p_day: query.data.day });
  if (error) return serverError("challenge", error);
  const row = data[0] ?? null;
  let card: CardSummary | null = null;
  try {
    if (row) [card = null] = await cardsByIds(supabase, [row.id!], row.language === "en" ? "en" : "fr");
  } catch (e) {
    return serverError("challenge:card", e);
  }

  let completed = false;
  if (card) {
    const { start, end } = dayBounds(query.data.day, offsetFrom(request));
    const { count } = await supabase
      .from("card_views")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("card_id", card.id!)
      .eq("action", "completed")
      .gte("created_at", start)
      .lt("created_at", end);
    completed = (count ?? 0) > 0;
  }
  const { data: profile } = await supabase.from("profiles").select("streak_count").eq("id", user.id).single();
  return NextResponse.json({ card, completed, streak: profile?.streak_count ?? 0 });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const body = await parseJson(request, challengeBodySchema);
  if (!body.ok) return body.response;
  const { error } = await auth.supabase
    .from("card_views")
    .insert({ user_id: auth.user.id, card_id: body.data.cardId, action: "completed" });
  if (error) return serverError("challenge:complete", error);
  const streak = await recordActivity(auth.supabase, body.data.day);
  return NextResponse.json({ ok: true, streak });
}
