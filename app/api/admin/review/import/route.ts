import { NextResponse } from "next/server";
import { jsonError, requireApiAdmin, serverError } from "@/lib/api";
import { applyReviewUpdates } from "@/lib/admin/apply";
import { parseReviewCsv } from "@/lib/admin/review-csv";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_BYTES = 5_000_000;

/** Re-imports a reviewed CSV (text/csv body). */
export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const csv = await request.text();
  if (!csv.trim()) return jsonError(400, "empty_file");
  if (csv.length > MAX_BYTES) return jsonError(413, "file_too_large");
  try {
    const db = createAdminClient();
    const result = await applyReviewUpdates(db, csv, parseReviewCsv);
    return NextResponse.json(result);
  } catch (error) {
    return serverError("admin:review:import", error);
  }
}
