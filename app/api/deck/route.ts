import { NextResponse } from "next/server";
import { jsonError, parseJson, parseQuery, requireApiUser, serverError } from "@/lib/api";
import { recordActivity } from "@/lib/activity";
import { clampPosition } from "@/lib/deck";
import { ensureDeck } from "@/lib/deck-server";
import { deckPositionBodySchema, deckQuerySchema } from "@/lib/validation/api";

/** The deck of a day: card ids in order, current position, size limit. */
export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const query = parseQuery(request, deckQuerySchema);
  if (!query.ok) return query.response;
  try {
    const deck = await ensureDeck(auth.supabase, auth.user.id, query.data.day, query.data.today === "1");
    return NextResponse.json(deck);
  } catch (e) {
    return serverError("deck:get", e);
  }
}

/** Moves to a position (forward or back). The first visit of a card counts as a read. */
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const body = await parseJson(request, deckPositionBodySchema);
  if (!body.ok) return body.response;
  const { supabase, user } = auth;
  const { day, position, today } = body.data;
  try {
    const isToday = day === today;
    const deck = await ensureDeck(supabase, user.id, day, isToday);
    if (deck.cardIds.length === 0) return jsonError(404, "empty_deck");
    const at = clampPosition(position, deck.cardIds.length);
    const { error } = await supabase.from("daily_deck_state").upsert({ user_id: user.id, deck_date: day, current_position: at, updated_at: new Date().toISOString() });
    if (error) throw error;
    if (!deck.seenPositions.includes(at)) {
      const cardId = deck.cardIds[at - 1]!;
      const [{ error: seenError }, { error: viewError }] = await Promise.all([
        supabase.from("daily_deck").update({ seen_at: new Date().toISOString() }).eq("user_id", user.id).eq("deck_date", day).eq("position", at),
        supabase.from("card_views").insert({ user_id: user.id, card_id: cardId, action: "seen" }),
      ]);
      if (seenError) throw seenError;
      if (viewError) throw viewError;
      if (isToday) await recordActivity(supabase, today);
    }
    // Unlimited decks grow when the reader gets near the end.
    const after = isToday ? await ensureDeck(supabase, user.id, day, true) : deck;
    return NextResponse.json({ ...after, position: at });
  } catch (e) {
    return serverError("deck:position", e);
  }
}
