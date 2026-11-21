import { NextResponse } from "next/server";
import { jsonError, parseJson, requireApiAdmin, serverError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminCardBodySchema } from "@/lib/validation/api";

/** Human review: approve (publish) or reject a card. */
export async function PATCH(request: Request) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const body = await parseJson(request, adminCardBodySchema);
  if (!body.ok) return body.response;
  const { cardId, status } = body.data;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cards")
    .update({
      status,
      rejection_reason: status === "rejected" ? `human_review:${auth.user.email ?? auth.user.id}` : null,
    })
    .eq("id", cardId)
    .select("id, status")
    .maybeSingle();
  if (error) return serverError("admin:cards", error);
  if (!data) return jsonError(404, "card_not_found");
  // Both versions follow the card: they are published or rejected together.
  const { error: translationError } = await admin
    .from("card_translations")
    .update({ status })
    .eq("card_id", cardId);
  if (translationError) return serverError("admin:translations", translationError);
  return NextResponse.json({ card: data });
}
