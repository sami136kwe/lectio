import { NextResponse } from "next/server";
import { jsonError, parseJson, requireApiAdmin, serverError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminPerspectiveBodySchema } from "@/lib/validation/api";

/** Theological review of one reading: reviewed, corrected (with a new body) or rejected. */
export async function PATCH(request: Request) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const body = await parseJson(request, adminPerspectiveBodySchema);
  if (!body.ok) return body.response;
  const { perspectiveId, review_status, body: text, reviewer_note } = body.data;
  if (review_status === "corrected" && !text) return jsonError(400, "body_required");

  const { data, error } = await createAdminClient()
    .from("card_perspectives")
    .update({
      review_status,
      ...(text ? { body: text, embedding: null } : {}),
      ...(reviewer_note !== undefined ? { reviewer_note } : {}),
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", perspectiveId)
    .select("id, review_status")
    .maybeSingle();
  if (error) return serverError("admin:perspectives", error);
  if (!data) return jsonError(404, "perspective_not_found");
  return NextResponse.json({ perspective: data });
}
