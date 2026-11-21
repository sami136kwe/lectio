/**
 * Export / re-import of the theological review queue as CSV, so readings can
 * be reviewed outside the app by a competent person of each tradition.
 *
 * Export columns: perspective_id, card_id, reference, language, tradition,
 * review_status, divergence_type, divergence_topic, body, sources, reviewer_note.
 * Re-import reads perspective_id, review_status, body and reviewer_note; a
 * changed body is stored with review_status "corrected".
 */
import { parseCsv } from "@/lib/bible/parse";

export const REVIEW_STATUSES = ["unreviewed", "reviewed", "corrected", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const EXPORT_COLUMNS = [
  "perspective_id",
  "card_id",
  "reference",
  "language",
  "tradition",
  "review_status",
  "divergence_type",
  "divergence_topic",
  "body",
  "sources",
  "reviewer_note",
] as const;

export type ReviewExportRow = Record<(typeof EXPORT_COLUMNS)[number], string>;

function cell(value: string): string {
  // Leading = + - @ would be run as formulas by spreadsheet apps.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: ReviewExportRow[]): string {
  const lines = [EXPORT_COLUMNS.join(",")];
  for (const r of rows) lines.push(EXPORT_COLUMNS.map((c) => cell(r[c] ?? "")).join(","));
  return `${lines.join("\r\n")}\r\n`;
}

export type ReviewUpdate = { perspective_id: string; review_status: ReviewStatus; body: string | null; reviewer_note: string | null };
export type ImportResult = { updates: ReviewUpdate[]; errors: string[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parses a re-imported CSV. `current` holds the bodies as they are in the
 * database: a different body marks the reading as corrected.
 */
export function parseReviewCsv(csv: string, current: Map<string, string>): ImportResult {
  const rows = parseCsv(csv.replace(/^﻿/, "")).filter((r) => r.some((c) => c.trim() !== ""));
  const errors: string[] = [];
  const updates: ReviewUpdate[] = [];
  const header = rows[0]?.map((h) => h.trim());
  if (!header) return { updates, errors: ["empty file"] };
  const col = (name: string) => header.indexOf(name);
  const idCol = col("perspective_id");
  const statusCol = col("review_status");
  if (idCol < 0 || statusCol < 0) return { updates, errors: ["columns perspective_id and review_status are required"] };
  const bodyCol = col("body");
  const noteCol = col("reviewer_note");

  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const id = r[idCol]?.trim() ?? "";
    if (!UUID.test(id)) return void errors.push(`line ${line}: invalid perspective_id`);
    if (!current.has(id)) return void errors.push(`line ${line}: unknown perspective ${id}`);
    let status = (r[statusCol]?.trim() ?? "") as ReviewStatus;
    if (!REVIEW_STATUSES.includes(status)) return void errors.push(`line ${line}: invalid review_status "${r[statusCol]}"`);
    const rawBody = bodyCol >= 0 ? (r[bodyCol] ?? "").trim().replace(/^'(?=[=+\-@])/, "") : "";
    const body = rawBody && rawBody !== current.get(id) ? rawBody : null;
    if (body && (body.length < 80 || body.length > 1400)) return void errors.push(`line ${line}: body must be 80 to 1400 characters`);
    if (body && status !== "rejected") status = "corrected";
    const note = noteCol >= 0 ? (r[noteCol] ?? "").trim() : "";
    if (note.length > 2000) return void errors.push(`line ${line}: reviewer_note too long`);
    updates.push({ perspective_id: id, review_status: status, body, reviewer_note: note || null });
  });
  return { updates, errors };
}
