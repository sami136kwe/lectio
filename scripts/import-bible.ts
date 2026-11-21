/**
 * Deterministic import of the Bible text (no model involved):
 *
 *   npm run import:bible                 every version
 *   npm run import:bible -- --version=WEB
 *   npm run import:bible -- --dry-run    download, parse and check, write nothing
 *
 * Each file is downloaded from a pinned commit into .cache/bible/, its SHA-256
 * is checked, then it is parsed and validated (encoding, duplicates, complete
 * NT, every psalm, numbering alignment, known verses). Nothing is written if a
 * single check fails.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BOOKS } from "@/lib/bible/books";
import { KNOWN_VERSES } from "@/lib/bible/known-verses";
import { confirmedRatio, parseBrentonJson, parseScrollmapperCsv, parseVrefCorpus, refKey, type ParsedVerse } from "@/lib/bible/parse";
import { PSALM_SEGMENTS } from "@/lib/bible/psalms";
import { ntReferenceKeys, validateVersion, type ValidationReport } from "@/lib/bible/validate";
import { VERSIONS, VREF_FILE, type SourceFile, type VersionDef } from "@/lib/bible/versions";
import { argValue, createServiceClient, hasFlag, type ScriptDb } from "./lib";

const CACHE = join(process.cwd(), ".cache", "bible");

export async function fetchPinned(file: SourceFile): Promise<string> {
  mkdirSync(CACHE, { recursive: true });
  const path = join(CACHE, file.sha256);
  const sha = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");
  if (existsSync(path)) {
    const cached = readFileSync(path);
    if (sha(cached) === file.sha256) return cached.toString("utf8");
  }
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(file.url, { headers: { "User-Agent": "Lectio-import/1.0" } });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${file.url}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const got = sha(buf);
      if (got !== file.sha256) throw new Error(`SHA-256 mismatch for ${file.url}: expected ${file.sha256}, got ${got}`);
      writeFileSync(path, buf);
      return buf.toString("utf8");
    } catch (error) {
      lastError = error;
      if (error instanceof Error && error.message.startsWith("SHA-256")) throw error;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  throw lastError;
}

function scopeBooks(def: VersionDef): Set<string> {
  return new Set(BOOKS.filter((b) => (b.code === "PSA" ? def.scope !== "nt" : def.scope !== "psalms")).map((b) => b.code));
}

async function parseVersion(def: VersionDef, vref: string): Promise<ParsedVerse[]> {
  const text = await fetchPinned(def.file);
  const keep = scopeBooks(def);
  switch (def.format) {
    case "vref":
      return parseVrefCorpus(vref, text, keep);
    case "scrollmapper_csv":
      return parseScrollmapperCsv(text, keep);
    case "brenton_json":
      return parseBrentonJson(text);
  }
}

export async function checkVersion(def: VersionDef, vref: string): Promise<{ verses: ParsedVerse[]; report: ValidationReport }> {
  const verses = await parseVersion(def, vref);
  const report = validateVersion(def, verses, ntReferenceKeys(vref));

  // Hebrew-numbered versions must match the psalm tables exactly: this is what proves MT_VERSE_COUNTS and TITLE_VERSES.
  if (def.versification !== "lxx") {
    for (const c of report.chapters) if (c.book === "PSA" && !c.aligned) report.errors.push(`Psalm ${c.chapter} does not match the reference tables`);
  }
  if (def.crossCheck) {
    const licensed = await fetchPinned(def.crossCheck);
    const ratio = confirmedRatio(verses, licensed);
    const line = `${(ratio * 100).toFixed(1)} % of verses confirmed word for word in the licensed eBible copy`;
    if (ratio < def.crossCheck.minConfirmedRatio) report.errors.push(`cross-check: only ${line}`);
    else report.warnings.push(`cross-check: ${line}`);
  }
  const byKey = new Map(verses.map((v) => [refKey(v.book, v.chapter, v.verse), v.text]));
  for (const k of KNOWN_VERSES.filter((k) => k.version === def.code)) {
    const text = byKey.get(k.ref);
    if (!text?.startsWith(k.startsWith)) report.errors.push(`known verse ${k.ref} does not match: "${text?.slice(0, 80) ?? "(missing)"}"`);
  }
  return { verses, report };
}

async function writeVersion(db: ScriptDb, def: VersionDef, verses: ParsedVerse[], report: ValidationReport) {
  const { data: version, error } = await db
    .from("bible_versions")
    .upsert(
      {
        code: def.code,
        name: def.name,
        language: def.language,
        textual_tradition: def.textual_tradition,
        versification: def.versification,
        scope: def.scope,
        license: def.license,
        source_url: def.file.url,
        source_sha256: def.file.sha256,
        attribution: def.attribution,
        verse_count: 0,
        imported_at: null,
      },
      { onConflict: "code" },
    )
    .select("id")
    .single();
  if (error) throw new Error(`${def.code}: ${error.message}`);

  for (const table of ["bible_verses", "bible_chapter_stats"] as const) {
    const { error: delError } = await db.from(table).delete().eq("version_id", version.id);
    if (delError) throw new Error(`${def.code} clear ${table}: ${delError.message}`);
  }
  const rows = verses.map((v) => ({ version_id: version.id, language: def.language, book_code: v.book, chapter: v.chapter, verse: v.verse, text: v.text }));
  for (let i = 0; i < rows.length; i += 1000) {
    const { error: insError } = await db.from("bible_verses").insert(rows.slice(i, i + 1000));
    if (insError) throw new Error(`${def.code} verses: ${insError.message}`);
  }
  const stats = report.chapters.map((c) => ({ version_id: version.id, book_code: c.book, chapter: c.chapter, verse_count: c.verse_count, expected_count: c.expected_count, aligned: c.aligned }));
  const { error: statError } = await db.from("bible_chapter_stats").insert(stats);
  if (statError) throw new Error(`${def.code} stats: ${statError.message}`);
  const { error: doneError } = await db.from("bible_versions").update({ verse_count: rows.length, imported_at: new Date().toISOString() }).eq("id", version.id);
  if (doneError) throw new Error(`${def.code}: ${doneError.message}`);
}

export async function importPsalmNumbering(db: ScriptDb) {
  const { error } = await db.from("psalm_numbering").upsert([...PSALM_SEGMENTS], { onConflict: "id" });
  if (error) throw new Error(`psalm_numbering: ${error.message}`);
}

async function main() {
  const only = argValue("version");
  const dryRun = hasFlag("dry-run");
  const defs = VERSIONS.filter((v) => !only || v.code === only);
  if (defs.length === 0) throw new Error(`unknown version ${only}`);

  const vref = await fetchPinned(VREF_FILE);
  const checked: { def: VersionDef; verses: ParsedVerse[]; report: ValidationReport }[] = [];
  let failed = false;
  for (const def of defs) {
    const { verses, report } = await checkVersion(def, vref);
    const misaligned = report.chapters.filter((c) => !c.aligned).length;
    console.log(
      `${report.errors.length ? "✖" : "✔"} ${def.code.padEnd(16)} ${String(report.verses).padStart(6)} verses (NT ${report.ntVerses}, Psalms ${report.psalmVerses}), ` +
        `${report.chapters.length} chapters, ${misaligned} with a different numbering`,
    );
    for (const w of report.warnings) console.log(`    · ${w}`);
    for (const e of report.errors.slice(0, 25)) console.log(`    ✖ ${e}`);
    if (report.errors.length > 25) console.log(`    ✖ … ${report.errors.length - 25} more`);
    if (report.errors.length) failed = true;
    checked.push({ def, verses, report });
  }
  if (failed) {
    console.error("\nImport aborted: fix the errors above. Nothing was written.");
    process.exit(1);
  }
  if (dryRun) {
    console.log("\nDry run: every check passed, nothing was written.");
    return;
  }
  const db = createServiceClient();
  await importPsalmNumbering(db);
  for (const { def, verses, report } of checked) {
    await writeVersion(db, def, verses, report);
    console.log(`  written ${def.code}`);
  }
  console.log(`\nDone: ${checked.reduce((n, c) => n + c.verses.length, 0)} verses, ${PSALM_SEGMENTS.length} psalm numbering rows.`);
}

if (process.argv[1]?.endsWith("import-bible.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
