import { describe, expect, it } from "vitest";
import { parseReviewCsv, toCsv, type ReviewExportRow } from "@/lib/admin/review-csv";

const ID = "2849f563-7a43-4054-b7ba-087cb81228bf";
const BODY = "La tradition catholique lit ici l'affirmation de la divinité du Fils, éternellement auprès du Père, sans cesser d'être Dieu.";
const row: ReviewExportRow = {
  perspective_id: ID,
  card_id: "90924f54-6c55-4e79-986b-fd099eac0d44",
  reference: "Jean 1, 1-5",
  language: "fr",
  tradition: "catholic",
  review_status: "unreviewed",
  divergence_type: "agree",
  divergence_topic: "",
  body: BODY,
  sources: "Bede, Catena Aurea, Chapter 1 (quote)",
  reviewer_note: "",
};

describe("review CSV", () => {
  it("round-trips an unchanged file as a plain status change", () => {
    const csv = toCsv([{ ...row, review_status: "reviewed", reviewer_note: "OK, conforme." }]);
    const { updates, errors } = parseReviewCsv(`﻿${csv}`, new Map([[ID, BODY]]));
    expect(errors).toEqual([]);
    expect(updates).toEqual([{ perspective_id: ID, review_status: "reviewed", body: null, reviewer_note: "OK, conforme." }]);
  });

  it("marks an edited body as corrected", () => {
    const edited = `${BODY} Elle rattache ce passage à la fête de Noël.`;
    const { updates } = parseReviewCsv(toCsv([{ ...row, review_status: "reviewed", body: edited }]), new Map([[ID, BODY]]));
    expect(updates[0]).toMatchObject({ review_status: "corrected", body: edited });
  });

  it("neutralises spreadsheet formulas and restores them on import", () => {
    const csv = toCsv([{ ...row, reviewer_note: "=HYPERLINK(1)" }]);
    expect(csv).toContain("'=HYPERLINK(1)");
  });

  it("rejects unknown ids, bad statuses and too-short bodies, line by line", () => {
    const csv = toCsv([
      { ...row, perspective_id: "11111111-1111-1111-1111-111111111111" },
      { ...row, review_status: "approved" },
      { ...row, body: "trop court" },
    ]);
    const { updates, errors } = parseReviewCsv(csv, new Map([[ID, BODY]]));
    expect(updates).toEqual([]);
    expect(errors).toHaveLength(3);
    expect(parseReviewCsv("a,b\n1,2", new Map()).errors[0]).toMatch(/required/);
  });
});
