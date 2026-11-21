/**
 * Import of the verified sources (no model involved):
 *
 *   npm run import:sources                     patristic sources + liturgy
 *   npm run import:sources -- --only=patristic
 *   npm run import:sources -- --only=liturgy
 *   npm run import:sources -- --embed          also compute embeddings (needs the `embed` Edge Function)
 *   npm run import:sources -- --dry-run
 *
 * Patristic: HistoricalChristianFaith/Commentaries-Database at a pinned commit,
 * public-domain translations only (lib/sources/patristic.ts). Liturgy: Roman
 * Sunday lectionary (LiturgicalCalendarAPI) and GOARCH Byzantine readings
 * (orthocal-python), pinned files checked by SHA-256.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { toVectorLiteral, edgeFunctionEmbedder } from "@/lib/ingestion/embeddings";
import { byzantineRows, romanRows, type LiturgyRow } from "@/lib/liturgy/lectionary";
import { isMachineTranslation, parseCommentaryToml, toSourceRow, workText, type SourceRow } from "@/lib/sources/patristic";
import { fetchPinned } from "./import-bible";
import { argValue, createServiceClient, hasFlag, type ScriptDb } from "./lib";

const COMMENTARIES = {
  repo: "https://github.com/HistoricalChristianFaith/Commentaries-Database",
  commit: "a88dc031b9a186a2af5a29e45bdde82dd271e204",
  dir: "commentaries",
};
/** Full public-domain texts, used to prove that each excerpt comes from the 19th-century translation it cites. */
const WRITINGS = {
  repo: "https://github.com/HistoricalChristianFaith/Writings-Database",
  commit: "922f4b37546ecd3b6c2dc7fe978daf600a587e0c",
  dir: "writings",
};
const LITCAL_COMMIT = "0eb0504271b0fb4be4103b4dd08cbff135c457ac";
const ORTHOCAL_COMMIT = "63f5aa7acaff1422bbb40c0e0a1b29aca05bbb0e";
export const LITURGY_FILES = {
  romanA: {
    url: `https://raw.githubusercontent.com/Liturgical-Calendar/LiturgicalCalendarAPI/${LITCAL_COMMIT}/jsondata/sourcedata/rite/roman/lectionary/dominicale_et_festivum_A/en.json`,
    sha256: "4a005f38f36199b84b1224e7ea6a6b836c9ffbf52d24e4fe7eb879e46563acc2",
  },
  romanB: {
    url: `https://raw.githubusercontent.com/Liturgical-Calendar/LiturgicalCalendarAPI/${LITCAL_COMMIT}/jsondata/sourcedata/rite/roman/lectionary/dominicale_et_festivum_B/en.json`,
    sha256: "86583e8ace4e27b1a84076023368cfe05235b03260f00b74a90f3f49140c48c5",
  },
  romanC: {
    url: `https://raw.githubusercontent.com/Liturgical-Calendar/LiturgicalCalendarAPI/${LITCAL_COMMIT}/jsondata/sourcedata/rite/roman/lectionary/dominicale_et_festivum_C/en.json`,
    sha256: "e65858297fc8f025cf658f248e51c6f39607ea9aa2e0e694be423dd240220317",
  },
  goarch: {
    url: `https://raw.githubusercontent.com/brianglass/orthocal-python/${ORTHOCAL_COMMIT}/data/goarch_readings_2018_2027.json`,
    sha256: "c8e29ea4965217a6968612799341c451680c0094a4211eca60d442affcf9c99a",
  },
};
/** Byzantine readings are dated: keep the current and the next year. */
const BYZANTINE_YEARS = [2026, 2027];

function ensureRepo(spec: { repo: string; commit: string; dir: string }): string {
  const dir = join(process.cwd(), ".cache", "sources", spec.dir);
  mkdirSync(join(dir, ".."), { recursive: true });
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  if (!existsSync(join(dir, ".git"))) {
    console.log(`Cloning ${spec.repo} (about 450 MB)…`);
    execFileSync("git", ["clone", "--quiet", "--depth", "1", spec.repo, dir], { stdio: "inherit" });
  }
  if (git("rev-parse", "HEAD") !== spec.commit) {
    git("fetch", "--quiet", "--depth", "1", "origin", spec.commit);
    git("checkout", "--quiet", spec.commit);
  }
  if (git("rev-parse", "HEAD") !== spec.commit) throw new Error(`${spec.repo} is not at the pinned commit`);
  return dir;
}

function regionOf(metadata: string): "east" | "west" | null {
  const m = /father_category\s*=\s*'([^']*)'/.exec(metadata);
  if (!m) return null;
  if (/Eastern|Syriac/.test(m[1]!)) return "east";
  if (/Western/.test(m[1]!)) return "west";
  return null;
}

export function collectPatristic(dir: string, writingsDir: string): { rows: SourceRow[]; skipped: Record<string, number>; unreadable: number } {
  const rows = new Map<string, SourceRow>();
  const skipped: Record<string, number> = {};
  let unreadable = 0;
  const works = new Map<string, string | null>();
  const loadWork = (path: string): string | null => {
    if (!works.has(path)) {
      const file = join(writingsDir, path.endsWith(".html") || path.endsWith(".htm") ? path : `${path}.html`);
      if (!file.startsWith(writingsDir) || !existsSync(file)) works.set(path, null);
      else {
        const html = readFileSync(file, "utf8");
        works.set(path, isMachineTranslation(html) ? null : workText(html));
      }
    }
    return works.get(path) ?? null;
  };
  for (const author of readdirSync(dir)) {
    const authorDir = join(dir, author);
    if (author.startsWith(".") || !statSync(authorDir).isDirectory()) continue;
    const metaPath = join(authorDir, "metadata.toml");
    const region = existsSync(metaPath) ? regionOf(readFileSync(metaPath, "utf8")) : null;
    for (const file of readdirSync(authorDir)) {
      if (!file.endsWith(".toml") || file === "metadata.toml") continue;
      const entries = parseCommentaryToml(readFileSync(join(authorDir, file), "utf8"));
      if (!entries) {
        unreadable += 1;
        continue;
      }
      for (const entry of entries) {
        const verdict = toSourceRow(author, file, entry, region, loadWork);
        if ("row" in verdict) rows.set(verdict.row.content_hash, verdict.row);
        else skipped[verdict.skip] = (skipped[verdict.skip] ?? 0) + 1;
      }
    }
  }
  return { rows: [...rows.values()], skipped, unreadable };
}

async function upsertSources(db: ScriptDb, rows: SourceRow[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from("sources").upsert(rows.slice(i, i + 500), { onConflict: "content_hash", ignoreDuplicates: false });
    if (error) throw new Error(`sources: ${error.message}`);
    if (i % 5000 === 0) process.stdout.write(`  ${i + Math.min(500, rows.length - i)} / ${rows.length}\r`);
  }
  console.log();
}

async function importLiturgy(db: ScriptDb, dryRun: boolean) {
  const roman: LiturgyRow[] = [];
  const skippedKeys: string[] = [];
  const files = { A: LITURGY_FILES.romanA, B: LITURGY_FILES.romanB, C: LITURGY_FILES.romanC } as const;
  for (const [cycle, file] of Object.entries(files) as ["A" | "B" | "C", (typeof files)["A"]][]) {
    const { rows, skipped } = romanRows(JSON.parse(await fetchPinned(file)) as Record<string, unknown>, cycle);
    roman.push(...rows);
    skippedKeys.push(...skipped.map((k) => `${cycle}:${k}`));
  }
  const goarch = JSON.parse(await fetchPinned(LITURGY_FILES.goarch)) as Record<string, unknown>;
  const byzantine = byzantineRows(goarch, BYZANTINE_YEARS, () => true);
  console.log(`Liturgy: ${roman.length} Roman uses (cycles A, B, C), ${byzantine.length} Byzantine uses (${BYZANTINE_YEARS.join(", ")})`);
  if (skippedKeys.length) console.log(`  · Roman keys without a known label (skipped): ${skippedKeys.join(", ")}`);
  if (dryRun) return;

  const { data: seasons, error: sError } = await db.from("liturgical_seasons").select("id, slug");
  if (sError) throw new Error(sError.message);
  const seasonId = new Map(seasons.map((s) => [s.slug, s.id]));

  const sourceFor = async (tradition: "catholic" | "orthodox", work: string, section: string, url: string, license: string, text: string) => {
    const { createHash } = await import("node:crypto");
    const row = {
      tradition,
      kind: "liturgical" as const,
      author: tradition === "catholic" ? "Lectionarium Romanum (Ordo Lectionum Missae, 1981)" : "Greek Orthodox Archdiocese of America",
      work,
      section,
      language: "en" as const,
      text,
      bible_refs: [],
      url,
      license,
      verified: true,
      content_hash: createHash("sha256").update(`${work}\n${section}\n${url}`).digest("hex"),
    };
    const { data, error } = await db.from("sources").upsert(row, { onConflict: "content_hash" }).select("id").single();
    if (error) throw new Error(error.message);
    return data.id;
  };

  const sourceIds: Record<string, string> = {};
  for (const cycle of ["A", "B", "C"] as const) {
    sourceIds[`roman:${cycle}`] = await sourceFor(
      "catholic",
      "Lectionary for Mass: Sundays and Solemnities",
      `Year ${cycle}`,
      files[cycle].url,
      "Reading references (facts) from LiturgicalCalendarAPI, Apache-2.0",
      `Sunday and solemnity readings of the Roman Lectionary, cycle ${cycle}, as encoded by the LiturgicalCalendarAPI project.`,
    );
  }
  sourceIds.byzantine = await sourceFor(
    "orthodox",
    "Daily readings (goarch.org chapel calendar)",
    BYZANTINE_YEARS.join("-"),
    LITURGY_FILES.goarch.url,
    "Reading references (facts) harvested by orthocal-python, MIT",
    "Epistle, Gospel and Matins Gospel of each day, Greek Orthodox Archdiocese of America, harvested by the orthocal-python project.",
  );

  const { error: delError } = await db.from("liturgical_uses").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (delError) throw new Error(delError.message);
  const toInsert = [...roman, ...byzantine].map((r) => ({
    book_code: r.book,
    chapter_start: r.chapterStart,
    verse_start: r.verseStart,
    chapter_end: r.chapterEnd,
    verse_end: r.verseEnd,
    tradition: r.tradition,
    rite: r.rite,
    occasion_type: r.occasion_type,
    description_fr: r.description_fr,
    description_en: r.description_en,
    calendar: r.calendar,
    season_id: r.season ? (seasonId.get(r.season) ?? null) : null,
    source_id: r.rite === "roman" ? sourceIds[`roman:${r.key[0]}`]! : sourceIds.byzantine!,
    verified: true,
  }));
  for (let i = 0; i < toInsert.length; i += 1000) {
    const { error } = await db.from("liturgical_uses").insert(toInsert.slice(i, i + 1000));
    if (error) throw new Error(`liturgical_uses: ${error.message}`);
  }
  console.log(`  written ${toInsert.length} liturgical uses`);
}

async function embedSources(db: ScriptDb) {
  const url = process.env.EMBEDDING_FUNCTION_URL ?? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/embed`;
  const secret = process.env.EMBEDDING_FUNCTION_SECRET;
  if (!secret) throw new Error("EMBEDDING_FUNCTION_SECRET is not set");
  const embed = edgeFunctionEmbedder(url, secret, "Lectio-import/1.0");
  let done = 0;
  for (;;) {
    const { data, error } = await db.from("sources").select("id, author, work, text").is("embedding", null).eq("kind", "patristic").limit(64);
    if (error) throw new Error(error.message);
    if (data.length === 0) break;
    const vectors = await embed(data.map((s) => `${s.author}, ${s.work}\n${(s.text ?? "").slice(0, 3500)}`));
    for (const [i, s] of data.entries()) {
      const { error: upError } = await db.from("sources").update({ embedding: toVectorLiteral(vectors[i]!) }).eq("id", s.id);
      if (upError) throw new Error(upError.message);
    }
    done += data.length;
    process.stdout.write(`  embedded ${done}\r`);
  }
  console.log(`\n  ${done} sources embedded`);
}

async function main() {
  const only = argValue("only");
  const dryRun = hasFlag("dry-run");
  const db = dryRun ? null : createServiceClient();
  if (!only || only === "patristic") {
    const dir = ensureRepo(COMMENTARIES);
    const { rows, skipped, unreadable } = collectPatristic(dir, ensureRepo(WRITINGS));
    const byAuthor = new Map<string, number>();
    for (const r of rows) byAuthor.set(r.author, (byAuthor.get(r.author) ?? 0) + 1);
    console.log(`Patristic: ${rows.length} verified extracts from ${byAuthor.size} authors (public-domain translations only)`);
    console.log(`  skipped: ${Object.entries(skipped).map(([k, v]) => `${k} ${v}`).join(", ")}; unreadable files: ${unreadable}`);
    console.log(`  top: ${[...byAuthor.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([a, n]) => `${a} ${n}`).join(", ")}`);
    if (db) {
      // Rows that no longer pass the checks are no longer verified (they stay for existing links).
      const { error } = await db.from("sources").update({ verified: false }).eq("kind", "patristic");
      if (error) throw new Error(error.message);
      await upsertSources(db, rows);
      const { data: linked, error: lError } = await db.from("perspective_sources").select("source_id");
      if (lError) throw new Error(lError.message);
      const keep = new Set(linked.map((l) => l.source_id));
      const { data: stale, error: sError } = await db.from("sources").select("id").eq("kind", "patristic").eq("verified", false);
      if (sError) throw new Error(sError.message);
      const drop = stale.map((s) => s.id).filter((id) => !keep.has(id));
      for (let i = 0; i < drop.length; i += 200) {
        const { error: dError } = await db.from("sources").delete().in("id", drop.slice(i, i + 200));
        if (dError) throw new Error(dError.message);
      }
      console.log(`  removed ${drop.length} extracts that no longer pass the checks`);
    }
  }
  if (!only || only === "liturgy") await importLiturgy(db!, dryRun);
  if (db && hasFlag("embed")) await embedSources(db);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
