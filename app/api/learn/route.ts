import { NextResponse } from "next/server";
import { parseJson, requireApiUser, serverError } from "@/lib/api";
import { cardsByIds } from "@/lib/cards";
import { learnBodySchema } from "@/lib/validation/api";

/** Verses due for memorisation now, with their mask level. */
export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  try {
    const { data, error } = await supabase
      .from("verse_memory")
      .select("card_id, mask_level, next_review_at")
      .eq("user_id", user.id)
      .lte("next_review_at", new Date().toISOString())
      .order("next_review_at")
      .limit(20);
    if (error) throw error;
    const { count } = await supabase.from("verse_memory").select("card_id", { count: "exact", head: true }).eq("user_id", user.id);
    const { data: profile } = await supabase.from("profiles").select("language").eq("id", user.id).single();
    const cards = await cardsByIds(supabase, data.map((d) => d.card_id), profile?.language === "en" ? "en" : "fr");
    const level = new Map(data.map((d) => [d.card_id, d.mask_level]));
    return NextResponse.json({ total: count ?? 0, items: cards.map((card) => ({ card, maskLevel: level.get(card.id!) ?? 0 })) });
  } catch (e) {
    return serverError("learn:list", e);
  }
}

/** Adds a card's passage to the verses to learn (idempotent). */
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const body = await parseJson(request, learnBodySchema);
  if (!body.ok) return body.response;
  const { error } = await auth.supabase.from("verse_memory").upsert({ user_id: auth.user.id, card_id: body.data.cardId }, { onConflict: "user_id,card_id", ignoreDuplicates: true });
  if (error) return serverError("learn:add", error);
  return NextResponse.json({ ok: true });
}
