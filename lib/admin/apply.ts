import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { parseReviewCsv, type ImportResult } from "./review-csv";

/** Parses a review CSV against the current bodies and writes the updates. Shared by the admin route and `npm run review:import`. */
export async function applyReviewUpdates(
  db: SupabaseClient<Database>,
  csv: string,
  parse: typeof parseReviewCsv = parseReviewCsv,
): Promise<{ updated: number; errors: string[] }> {
  const ids = [...csv.matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)].map((m) => m[0].toLowerCase());
  const current = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from("card_perspectives").select("id, body").in("id", [...new Set(ids.slice(i, i + 200))]);
    if (error) throw new Error(error.message);
    for (const r of data) current.set(r.id, r.body);
  }
  const { updates, errors }: ImportResult = parse(csv, current);
  let updated = 0;
  for (const u of updates) {
    const { error } = await db
      .from("card_perspectives")
      .update({
        review_status: u.review_status,
        reviewer_note: u.reviewer_note,
        reviewed_at: u.review_status === "unreviewed" ? null : new Date().toISOString(),
        ...(u.body ? { body: u.body, embedding: null } : {}),
      })
      .eq("id", u.perspective_id);
    if (error) errors.push(`${u.perspective_id}: ${error.message}`);
    else updated += 1;
  }
  return { updated, errors };
}
