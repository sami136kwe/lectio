/**
 * Patristic sources from the HistoricalChristianFaith Commentaries-Database
 * (public-domain dedication). That repository also holds fair-use excerpts of
 * modern, copyrighted translations: only the works listed in PD_WORKS — all
 * from 19th-century translations (Schaff's Ante-Nicene and Nicene and
 * Post-Nicene Fathers, Newman's edition of the Catena Aurea, the Library of
 * the Fathers) — are imported. Everything else is skipped.
 */
import { createHash } from "node:crypto";
import { BOOKS } from "@/lib/bible/books";
import { verseKey } from "@/lib/bible/reference";

export type PdWork = {
  /** Matched against the decoded `file=` path of the source URL. */
  path: RegExp;
  work: string;
  translation: string;
  /** "catholic" for the Catena Aurea (compiled by Thomas Aquinas), "common" for the undivided Church's Fathers. */
  tradition: "common" | "catholic";
};

export const PD_WORKS: PdWork[] = [
  { path: /^Thomas Aquinas\/Catena Aurea\/Commentary on (Matthew|Mark|Luke|John)\//, work: "Catena Aurea", translation: "J. H. Newman (ed.), Oxford, 1841-1845", tradition: "catholic" },
  { path: /^John Chrysostom\/Homilies\/On (Matthew|John|the Acts of the Apostles|Romans|1 Corinthians|2 Corinthians|Galatians|Ephesians|Philippians|Colossians|1 Thessalonians|2 Thessalonians|1 Timothy|2 Timothy|Titus|Philemon|Hebrews)\//, work: "Homilies", translation: "Nicene and Post-Nicene Fathers, 1st series, vol. 10-14 (1886-1889)", tradition: "common" },
  { path: /^Augustine of Hippo\/The Harmony of the Gospels\//, work: "The Harmony of the Gospels", translation: "Nicene and Post-Nicene Fathers, 1st series, vol. 6 (1888)", tradition: "common" },
  { path: /^Cyril of Alexandria\/Commentary on the Gospel of John/, work: "Commentary on the Gospel of John", translation: "Library of the Fathers, vol. 43 and 48 (1874-1885)", tradition: "common" },
  { path: /^Cyril of Alexandria\/Commentary on the Gospel of Luke/, work: "Commentary on the Gospel of Luke", translation: "R. Payne Smith, Oxford, 1859", tradition: "common" },
  { path: /^Origen of Alexandria\/Commentary on John\//, work: "Commentary on John", translation: "Ante-Nicene Fathers, vol. 9 (1896)", tradition: "common" },
  { path: /^Leo the Great\/Sermons\//, work: "Sermons", translation: "Nicene and Post-Nicene Fathers, 2nd series, vol. 12 (1895)", tradition: "common" },
  { path: /^Irenaeus\/Irenaeus Against Heresies Book [1-5]/, work: "Against Heresies", translation: "Ante-Nicene Fathers, vol. 1 (1885)", tradition: "common" },
  { path: /^Hilary of Poitiers\/On the Trinity\//, work: "On the Trinity", translation: "Nicene and Post-Nicene Fathers, 2nd series, vol. 9 (1899)", tradition: "common" },
  { path: /^Basil of Caesarea\/ON THE SPIRIT/, work: "On the Holy Spirit", translation: "Nicene and Post-Nicene Fathers, 2nd series, vol. 8 (1895)", tradition: "common" },
  { path: /^Athanasius of Alexandria\/(On the Incarnation|Four Discourses Against the Arians|Against the Heathen|Letters)/, work: "Works", translation: "Nicene and Post-Nicene Fathers, 2nd series, vol. 4 (1892)", tradition: "common" },
  { path: /^Cyprian\/(Treatise|Epistle)/, work: "Treatises and Epistles", translation: "Ante-Nicene Fathers, vol. 5 (1886)", tradition: "common" },
  { path: /^Ignatius of Antioch\/Epistle to /, work: "Epistles", translation: "Ante-Nicene Fathers, vol. 1 (1885)", tradition: "common" },
  { path: /^Polycarp of Smyrna\/Epistle to the Philippians/, work: "Epistle to the Philippians", translation: "Ante-Nicene Fathers, vol. 1 (1885)", tradition: "common" },
  { path: /^Justin Martyr\/(Dialogue with Trypho|First Apology|Second Apology)/, work: "Works", translation: "Ante-Nicene Fathers, vol. 1 (1885)", tradition: "common" },
  { path: /^Clement of Alexandria\/(The Stromata|The Instructor|Exhortation)/, work: "Works", translation: "Ante-Nicene Fathers, vol. 2 (1885)", tradition: "common" },
  { path: /^Victorinus of Pettau\/Commentary on the Apocalypse of the Blessed John/, work: "Commentary on the Apocalypse", translation: "Ante-Nicene Fathers, vol. 7 (1886)", tradition: "common" },
];

/** Letters and digits only, lowercase, without accents. */
export function loose(text: string): string {
  return text.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Full text of a work page (HTML from the Writings-Database), as loose text. */
export function workText(html: string): string {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)));
  return loose(text);
}

/** Work pages that declare a machine translation are never accepted. */
export function isMachineTranslation(html: string): boolean {
  return /chat\s?gpt|machine[- ]translat|translated (?:by|with) (?:an )?ai\b|gpt-\d/i.test(html.slice(0, 5000));
}

/**
 * Provenance proof: every paragraph of the excerpt (at least 30 letters long)
 * must appear word for word in the public-domain text of the work it cites.
 * Catena Aurea paragraphs start with a reference in brackets, e.g. "(Tract. xcii. 2)".
 */
export function foundInWork(excerpt: string, work: string): boolean {
  const paragraphs = excerpt
    .split(/\n\s*\n/)
    .map((p) => p.replace(/^\s*\([^)]{1,80}\)\s*/, "").replace(/…/g, " "))
    .map(loose)
    .filter((p) => p.length >= 30);
  if (paragraphs.length === 0) return false;
  return paragraphs.every((p) => {
    // Excerpts are sometimes cut mid-sentence: compare the first 400 letters of each paragraph.
    return work.includes(p.slice(0, 400));
  });
}

export type CommentaryEntry = { quote: string; source_url: string; source_title: string; append_to_author_name: string };

function unescapeBasic(s: string): string {
  return s.replace(/\\(["\\nt])/g, (_, c: string) => (c === "n" ? "\n" : c === "t" ? "\t" : c));
}

/**
 * Minimal reader for the TOML subset these files use: [[commentary]] tables
 * with ''' / """ multi-line strings and ' / " single-line strings.
 * Returns null on anything else, so an unexpected file is skipped, not guessed.
 */
export function parseCommentaryToml(text: string): CommentaryEntry[] | null {
  const entries: CommentaryEntry[] = [];
  let current: Record<string, string> | null = null;
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line || line.startsWith("#")) continue;
    if (line === "[[commentary]]") {
      current = {};
      entries.push(current as unknown as CommentaryEntry);
      continue;
    }
    const m = /^([a-z_]+)\s*=\s*(.*)$/.exec(line);
    if (!m || !current) return null;
    const [, key, rest] = m as unknown as [string, string, string];
    const multi = rest.startsWith("'''") ? "'''" : rest.startsWith('"""') ? '"""' : null;
    if (multi) {
      let body = rest.slice(3);
      const collected: string[] = [];
      let closed = body.indexOf(multi);
      while (closed < 0) {
        collected.push(body);
        i += 1;
        if (i >= lines.length) return null;
        body = lines[i]!;
        closed = body.indexOf(multi);
      }
      collected.push(body.slice(0, closed));
      const value = collected.join("\n").replace(/^\n/, "");
      current[key] = multi === '"""' ? unescapeBasic(value) : value;
    } else if (/^'[^']*'$/.test(rest)) current[key] = rest.slice(1, -1);
    else if (/^"(?:[^"\\]|\\.)*"$/.test(rest)) current[key] = unescapeBasic(rest.slice(1, -1));
    else if (/^-?\d+$/.test(rest)) current[key] = rest;
    else return null;
  }
  return entries.map((e) => ({ quote: e.quote ?? "", source_url: e.source_url ?? "", source_title: e.source_title ?? "", append_to_author_name: e.append_to_author_name ?? "" }));
}

const BOOK_BY_LONG_NAME = new Map(BOOKS.filter((b) => b.code !== "PSA").map((b) => [b.name_en, b.code]));

/**
 * Bible verse keys from a file name: "John 3_16.toml", "John 3_16-18.toml",
 * "Matthew 26_36-27_2.toml". NT only (the Psalm numbering of the files is not documented).
 */
export function refsFromFilename(name: string): string[] | null {
  const m = /^(.+?) (\d+)_(\d+)(?:-(?:(\d+)_)?(\d+))?\.toml$/.exec(name);
  if (!m) return null;
  const code = BOOK_BY_LONG_NAME.get(m[1]!);
  if (!code) return null;
  const c1 = Number(m[2]);
  const v1 = Number(m[3]);
  const c2 = m[4] ? Number(m[4]) : c1;
  const v2 = m[5] ? Number(m[5]) : v1;
  if (c2 < c1 || (c2 === c1 && v2 < v1)) return null;
  const keys: string[] = [];
  for (let c = c1; c <= c2 && keys.length < 300; c++) {
    const from = c === c1 ? v1 : 1;
    const to = c === c2 ? v2 : 80;
    for (let v = from; v <= to && keys.length < 300; v++) keys.push(verseKey(code, c, v));
  }
  return keys;
}

const STOPWORDS = new Set("the and of to that in is he not for it with as his be this which was but by they are him we from at so have all you will his them their who or an had what our not when".split(" "));

/** Rough language check: share of common English words. */
export function looksEnglish(text: string): boolean {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  if (words.length < 8) return false;
  return words.filter((w) => STOPWORDS.has(w)).length / words.length >= 0.15;
}

export function decodedPath(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.hostname !== "historicalchristian.faith") return null;
  const file = u.searchParams.get("file");
  if (!file) return null;
  let path = file;
  // The URLs are encoded twice.
  for (let i = 0; i < 2 && /%[0-9A-F]{2}/i.test(path); i++) path = decodeURIComponent(path);
  return path;
}

export type SourceRow = {
  tradition: "common" | "catholic";
  kind: "patristic";
  author: string;
  work: string;
  section: string;
  language: "en";
  text: string;
  bible_refs: string[];
  url: string;
  license: string;
  verified: boolean;
  region: "east" | "west" | null;
  content_hash: string;
};

export type Verdict = { row: SourceRow } | { skip: string };

/** Turns one commentary entry into a source row, or says why it is skipped. */
export function toSourceRow(
  author: string,
  fileName: string,
  entry: CommentaryEntry,
  region: "east" | "west" | null,
  /** Loose full text of the cited work, or null when the work file is missing or machine-translated. */
  loadWork: (path: string) => string | null,
): Verdict {
  const refs = refsFromFilename(fileName);
  if (!refs) return { skip: "reference" };
  const path = decodedPath(entry.source_url);
  if (!path) return { skip: "url" };
  const work = PD_WORKS.find((w) => w.path.test(path));
  if (!work) return { skip: "not_public_domain" };
  const text = entry.quote.replace(/\s+\n/g, "\n").trim();
  if (text.length < 40) return { skip: "too_short" };
  if (!looksEnglish(text)) return { skip: "language" };
  const work_text = loadWork(path);
  if (!work_text) return { skip: "work_text_missing" };
  if (!foundInWork(text, work_text)) return { skip: "not_in_public_domain_text" };
  // "Father/Work[/Sub-work]/Section": e.g. "John Chrysostom/Homilies/On John/Homily 27".
  const parts = path.replace(/\.html?$/, "").split("/");
  const nested = parts.length >= 4;
  const workTitle =
    work.work === "Catena Aurea"
      ? `Catena Aurea (Thomas Aquinas), ${parts[2]}`
      : nested
        ? `${parts[1]} ${parts[2]}`
        : (parts[1] ?? work.work);
  const section = (nested ? parts.slice(3).join(", ") : parts.length === 3 ? parts[2]! : entry.source_title) || entry.source_title || "—";
  const content_hash = createHash("sha256").update(`${author}\n${workTitle}\n${section}\n${text}`).digest("hex");
  return {
    row: {
      tradition: work.tradition,
      kind: "patristic",
      author,
      work: workTitle,
      section,
      language: "en",
      text,
      bible_refs: refs,
      url: entry.source_url,
      license: `Public Domain (${work.translation}); compilation: HistoricalChristianFaith Commentaries-Database, public-domain dedication`,
      verified: true,
      region,
      content_hash,
    },
  };
}
