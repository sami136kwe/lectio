import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { mixFeed } from "@/lib/feed/mix";
import { cardsToAdd, type DailyLimit } from "@/lib/deck";

type Db = SupabaseClient<Database>;

export type DeckState = { date: string; position: number; cardIds: string[]; limit: DailyLimit; seenPositions: number[] };

async function load(db: Db, userId: string, date: string) {
  const [deck, state] = await Promise.all([
    db.from("daily_deck").select("card_id, position, seen_at").eq("user_id", userId).eq("deck_date", date).order("position"),
    db.from("daily_deck_state").select("current_position").eq("user_id", userId).eq("deck_date", date).maybeSingle(),
  ]);
  if (deck.error) throw new Error(deck.error.message);
  if (state.error) throw new Error(state.error.message);
  return { rows: deck.data, position: state.data?.current_position ?? 1 };
}

/** Today's (or a past day's) deck, created or extended as needed. Past days are never changed. */
export async function ensureDeck(db: Db, userId: string, date: string, today: boolean): Promise<DeckState> {
  const { data: profile, error } = await db.from("profiles").select("language, interests, daily_limit").eq("id", userId).single();
  if (error) throw new Error(error.message);
  const limit: DailyLimit = profile.daily_limit === "50" ? "50" : "unlimited";
  let { rows, position } = await load(db, userId, date);
  const add = today ? cardsToAdd(limit, rows.length, position) : 0;
  if (add > 0) {
    const language = profile.language === "en" ? "en" : "fr";
    const hasInterests = profile.interests.length > 0;
    const [interest, discovery] = await Promise.all([
      db.rpc("feed_candidates", { p_language: language, p_category_ids: profile.interests, p_include: true, p_limit: add * 2 }),
      hasInterests ? db.rpc("feed_candidates", { p_language: language, p_category_ids: profile.interests, p_include: false, p_limit: add }) : Promise.resolve({ data: [], error: null }),
    ]);
    if (interest.error) throw new Error(interest.error.message);
    if (discovery.error) throw new Error(discovery.error.message);
    const inDeck = new Set(rows.map((r) => r.card_id));
    const picked = mixFeed(interest.data.filter((c) => !inDeck.has(c.id)), (discovery.data ?? []).filter((c) => !inDeck.has(c.id)), add);
    if (picked.length) {
      const start = rows.length;
      const { error: insError } = await db
        .from("daily_deck")
        .insert(picked.map((c, i) => ({ user_id: userId, deck_date: date, card_id: c.id, position: start + i + 1 })));
      // A concurrent request may have built the deck at the same moment: reload either way.
      if (insError && !/duplicate key/.test(insError.message)) throw new Error(insError.message);
      ({ rows, position } = await load(db, userId, date));
    }
  }
  return { date, position, limit, cardIds: rows.map((r) => r.card_id), seenPositions: rows.filter((r) => r.seen_at).map((r) => r.position) };
}
