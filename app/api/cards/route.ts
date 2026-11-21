import { NextResponse } from "next/server";
import { parseQuery, serverError } from "@/lib/api";
import { cardsByIds } from "@/lib/cards";
import { createClient } from "@/lib/supabase/server";
import { cardsQuerySchema } from "@/lib/validation/api";

/** Published cards by id in one language (deck window, FR/EN flip). */
export async function GET(request: Request) {
  const query = parseQuery(request, cardsQuerySchema);
  if (!query.ok) return query.response;
  try {
    const cards = await cardsByIds(await createClient(), query.data.ids, query.data.lang);
    return NextResponse.json({ cards });
  } catch (e) {
    return serverError("cards", e);
  }
}
