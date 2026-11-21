import { NextResponse } from "next/server";
import { jsonError, parseJson, requireApiUser, serverError } from "@/lib/api";
import { readingBodySchema } from "@/lib/validation/api";

/** Continuous reading: marks the card as read and remembers the position in its book. */
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const body = await parseJson(request, readingBodySchema);
  if (!body.ok) return body.response;
  const { supabase, user } = auth;
  const { cardId, day } = body.data;
  try {
    const { data: card, error } = await supabase.from("card_details").select("id, book_code, sort_key").eq("id", cardId).eq("status", "published").limit(1).maybeSingle();
    if (error) throw error;
    if (!card) return jsonError(404, "card_not_found");
    const [view, progress] = await Promise.all([
      supabase.from("card_views").insert({ user_id: user.id, card_id: cardId, action: "seen" }),
      supabase
        .from("reading_progress")
        .upsert({ user_id: user.id, book_code: card.book_code!, last_card_id: cardId, last_sort_key: card.sort_key!, updated_at: new Date().toISOString() }),
    ]);
    if (view.error) throw view.error;
    if (progress.error) throw progress.error;
    await supabase.rpc("record_activity", { p_day: day });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError("reading", error);
  }
}
