import { z } from "zod";

/** Client local date (YYYY-MM-DD), used for streaks and daily goals. */
export const daySchema = z.iso.date();
export const uuidSchema = z.uuid();

/** Comma-separated card ids already shown in this session. */
const excludeIds = z
  .string()
  .max(8000)
  .optional()
  .transform((v) => (v ? v.split(",").filter(Boolean) : []))
  .pipe(z.array(uuidSchema).max(200));

export const feedQuerySchema = z.object({
  size: z.coerce.number().int().min(1).max(30).default(10),
  since: z.iso.datetime({ offset: true }).optional(),
  exclude: excludeIds,
});

export const viewBodySchema = z.object({
  cardId: uuidSchema,
  action: z.enum(["seen", "skipped", "completed", "reread"]),
  day: daySchema,
});

export const stashBodySchema = z.object({ cardId: uuidSchema, day: daySchema });
export const unstashBodySchema = z.object({ cardId: uuidSchema });
export const noteBodySchema = z.object({ cardId: uuidSchema, note: z.string().max(2000).nullable() });

export const reviewBodySchema = z.object({
  cardId: uuidSchema,
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  day: daySchema,
});

export const challengeQuerySchema = z.object({ day: daySchema });
export const challengeBodySchema = z.object({ cardId: uuidSchema, day: daySchema });

export const profileBodySchema = z
  .object({
    display_name: z.string().trim().max(60).nullable(),
    interests: z.array(uuidSchema).max(16),
    daily_goal: z.union([z.literal(3), z.literal(5), z.literal(10)]),
    language: z.enum(["fr", "en"]),
    onboarded: z.boolean(),
    include_reread: z.boolean(),
    reread_ratio: z.union([z.literal(10), z.literal(20), z.literal(30), z.literal(50)]),
    daily_limit: z.enum(["50", "unlimited"]),
    timezone: z.string().min(1).max(64).regex(/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)*$/),
    tradition_view: z.enum(["both", "catholic", "orthodox", "neutral"]),
    bible_version_fr: z.enum(["LSG1910"]),
    bible_version_en: z.enum(["WEB", "KJV", "DRC"]),
    show_greek: z.boolean(),
    reviewed_only: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "empty update");

export const searchQuerySchema = z.object({ q: z.string().trim().min(2).max(100) });

export const adminCardBodySchema = z.object({
  cardId: uuidSchema,
  status: z.enum(["published", "rejected"]),
});

export const adminPerspectiveBodySchema = z.object({
  perspectiveId: uuidSchema,
  review_status: z.enum(["reviewed", "corrected", "rejected"]),
  body: z.string().trim().min(80).max(1400).optional(),
  reviewer_note: z.string().trim().max(2000).nullable().optional(),
});

export const adminQueueQuerySchema = z.object({
  tradition: z.enum(["catholic", "orthodox"]).optional(),
  book: z.string().regex(/^[1-3A-Z]{3}$/).optional(),
  divergence: z.enum(["1", "0"]).default("0"),
  status: z.enum(["unreviewed", "reviewed", "corrected", "rejected"]).default("unreviewed"),
});

export const rereadModeSchema = z.enum(["random", "oldest", "least", "stashed"]);

export const rereadQuerySchema = z.object({
  mode: rereadModeSchema.default("random"),
  category: uuidSchema.optional(),
  size: z.coerce.number().int().min(1).max(30).default(10),
  exclude: excludeIds,
});

export const historyQuerySchema = z.object({
  category: uuidSchema.optional(),
  sub: uuidSchema.optional(),
  stashed: z.enum(["1", "0"]).default("0"),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  q: z.string().trim().max(100).optional(),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});

export const reviewLaterBodySchema = z.object({ cardId: uuidSchema });

export const readingBodySchema = z.object({ cardId: uuidSchema, day: daySchema });
export const readingResetBodySchema = z.object({ book: z.string().regex(/^[1-3A-Z]{3}$/) });

export const deckQuerySchema = z.object({ day: daySchema, today: z.enum(["1", "0"]).default("1") });
export const deckPositionBodySchema = z.object({ day: daySchema, position: z.number().int().min(1).max(10_000), today: daySchema });
export const cardsQuerySchema = z.object({
  ids: z.string().max(400).transform((v) => v.split(",").filter(Boolean)).pipe(z.array(uuidSchema).min(1).max(10)),
  lang: z.enum(["fr", "en"]),
});
export const learnBodySchema = z.object({ cardId: uuidSchema });
export const learnReviewBodySchema = z.object({
  cardId: uuidSchema,
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  day: daySchema,
});
