import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { CATEGORY_SEED, SEASON_SEED, TRADITION_SEED } from "@/supabase/seed/categories";

config({ path: ".env.local" });
config();

export type ScriptDb = ReturnType<typeof createServiceClient>;

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example)");
  }
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

export function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

/** Upserts every category and subcategory, the traditions and the liturgical seasons (idempotent). */
export async function seedCategories(db: ScriptDb): Promise<{ categories: number; traditions: number; seasons: number }> {
  let categories = 0;
  for (const [index, main] of CATEGORY_SEED.entries()) {
    const { data: parent, error } = await db
      .from("categories")
      .upsert(
        {
          slug: main.slug,
          name_fr: main.name_fr,
          name_en: main.name_en,
          icon: main.icon,
          description: main.description,
          description_en: main.description_en,
          sort_order: index,
          parent_id: null,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();
    if (error) throw new Error(`category ${main.slug}: ${error.message}`);
    categories += 1;
    const subs = main.subcategories.map((sub, subIndex) => ({ ...sub, parent_id: parent.id, sort_order: subIndex }));
    const { error: subError } = await db.from("categories").upsert(subs, { onConflict: "slug" });
    if (subError) throw new Error(`subcategories of ${main.slug}: ${subError.message}`);
    categories += subs.length;
  }
  const { error: tError } = await db.from("traditions").upsert(TRADITION_SEED, { onConflict: "code" });
  if (tError) throw new Error(`traditions: ${tError.message}`);
  const seasons = SEASON_SEED.map((s, i) => ({ ...s, sort_order: i }));
  const { error: sError } = await db.from("liturgical_seasons").upsert(seasons, { onConflict: "slug" });
  if (sError) throw new Error(`seasons: ${sError.message}`);
  return { categories, traditions: TRADITION_SEED.length, seasons: seasons.length };
}
