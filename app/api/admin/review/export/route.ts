import { parseQuery, requireApiAdmin, serverError } from "@/lib/api";
import { reviewQueue, toExportRows } from "@/lib/admin/queue";
import { toCsv } from "@/lib/admin/review-csv";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminQueueQuerySchema } from "@/lib/validation/api";

/** CSV of the review queue (same filters as the admin page), for review outside the app. */
export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return auth.response;
  const query = parseQuery(request, adminQueueQuerySchema);
  if (!query.ok) return query.response;
  try {
    const { tradition, book, divergence, status } = query.data;
    const items = await reviewQueue(createAdminClient(), { tradition, book, divergence: divergence === "1", status }, 5000);
    const date = new Date().toISOString().slice(0, 10);
    return new Response(`﻿${toCsv(toExportRows(items))}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="lectio-review-${date}.csv"`,
      },
    });
  } catch (error) {
    return serverError("admin:review:export", error);
  }
}
