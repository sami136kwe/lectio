/**
 * Bible versions imported by `npm run import:bible`.
 *
 * Every file is downloaded from a pinned commit and checked against its
 * SHA-256 before parsing, so the import is reproducible byte for byte.
 * Licences are documented in docs/SOURCES.md.
 */
import type { Versification } from "./psalms";

export type SourceFile = { url: string; sha256: string };

export type VersionFormat = "vref" | "scrollmapper_csv" | "brenton_json";

export type VersionDef = {
  code: string;
  name: string;
  language: "fr" | "en" | "grc";
  textual_tradition: "hebrew" | "septuagint" | "vulgate" | "greek_byzantine";
  versification: Versification;
  scope: "nt" | "psalms" | "nt_psalms";
  license: string;
  attribution: string;
  format: VersionFormat;
  file: SourceFile;
  /** Licensed copy of the same text used to confirm a repackaged file (Brenton). */
  crossCheck?: SourceFile & { minConfirmedRatio: number };
  /**
   * NT verses (reference numbering) known to be absent from this file: textual
   * variants that the edition prints in brackets, in a footnote or elsewhere
   * (e.g. Rom 16:25-27 after Rom 14:23 in Byzantine texts). Anything else missing
   * fails the import.
   */
  allowedMissing: string[];
  /** NT verses present in this file but not in the reference numbering. */
  allowedExtra?: string[];
  /**
   * NT chapters whose verse division differs from the reference numbering
   * (Vulgate divisions in the Douay-Rheims): never mapped verse by verse.
   */
  divergentChapters?: string[];
};

const EBIBLE_COMMIT = "2bde52b4c2cfd7056cf4ed07c48969647df79744";
const SCROLLMAPPER_COMMIT = "59b18c5af5845728c275d5b7178ad0d024172b1f";
const BRENTON_COMMIT = "01fd3f66dc44da3cff1c85319410dc3213867774";

const ebible = (path: string, sha256: string): SourceFile => ({
  url: `https://raw.githubusercontent.com/BibleNLP/ebible/${EBIBLE_COMMIT}/${path}`,
  sha256,
});

/** Line-by-line verse reference list shared by every eBible corpus file. */
export const VREF_FILE = ebible("metadata/vref.txt", "a7575f550dd2260cf707f98c909a551f5b1ef9c0b52e1e3ccce96df1f2dba845");

export const VERSIONS: VersionDef[] = [
  {
    code: "LSG1910",
    name: "Louis Segond 1910",
    language: "fr",
    textual_tradition: "hebrew",
    versification: "mt",
    scope: "nt_psalms",
    license: "Public Domain",
    attribution: "Louis Segond, 1910. Texte du domaine public, fichier eBible.org (fraLSG) via BibleNLP/ebible.",
    format: "vref",
    file: ebible("corpus/fra-fraLSG.txt", "238a9d145d1ffcc7b4aed63d27dd351c2ff0b7a31a7f2b2514507d094af4a271"),
    allowedMissing: [],
  },
  {
    code: "WEB",
    name: "World English Bible",
    language: "en",
    textual_tradition: "hebrew",
    versification: "eng",
    scope: "nt_psalms",
    license: "Public Domain (\"World English Bible\" is a trademark of eBible.org)",
    attribution: "World English Bible, public domain, eBible.org (engwebp) via BibleNLP/ebible.",
    format: "vref",
    file: ebible("corpus/eng-engwebp.txt", "a9cbd39e2cf499d3dde45ac5c8991b257137e8e57fa89c1ce2508c87fedc3611"),
    allowedMissing: ["LUK 17:36", "ACT 8:37", "ACT 15:34", "ACT 24:7", "ROM 16:25", "ROM 16:26", "ROM 16:27", "3JN 1:15", "REV 12:18"],
  },
  {
    code: "KJV",
    name: "King James Version (Cambridge Paragraph Bible)",
    language: "en",
    textual_tradition: "hebrew",
    versification: "eng",
    scope: "nt_psalms",
    license: "Public Domain",
    attribution: "King James Version, Cambridge Paragraph Bible edition, public domain, eBible.org (engkjvcpb) via BibleNLP/ebible.",
    format: "vref",
    file: ebible("corpus/eng-engkjvcpb.txt", "3f8037b4ff1f04e5c2f5fad782ee319c01bb49e0e74c5848d628e5e4118396c9"),
    allowedMissing: ["3JN 1:15", "REV 12:18"],
  },
  {
    code: "DRC",
    name: "Douay-Rheims, Challoner revision",
    language: "en",
    textual_tradition: "vulgate",
    versification: "lxx",
    scope: "nt_psalms",
    license: "Public Domain",
    attribution: "Douay-Rheims Bible, Challoner revision (1749-1752), public domain, scrollmapper/bible_databases (DRC).",
    format: "scrollmapper_csv",
    file: {
      url: `https://raw.githubusercontent.com/scrollmapper/bible_databases/${SCROLLMAPPER_COMMIT}/formats/csv/DRC.csv`,
      sha256: "beedae44c6253903ffeac0987db858b0787c32ad3a70969debf1e98348d4b201",
    },
    allowedMissing: ["MAT 17:27", "MRK 4:41", "MRK 9:50", "JHN 11:57", "ACT 7:60", "ACT 14:28", "2CO 1:24", "1TH 4:18", "2TH 2:17", "3JN 1:15"],
    allowedExtra: ["MRK 8:39", "JHN 6:72"],
    divergentChapters: ["MAT 17", "MRK 4", "MRK 8", "MRK 9", "JHN 6", "JHN 11", "ACT 7", "ACT 14", "2CO 1", "1TH 4", "2TH 2", "3JN 1"],
  },
  {
    code: "BRENTON_LXX",
    name: "Brenton's English Septuagint (1851)",
    language: "en",
    textual_tradition: "septuagint",
    versification: "lxx",
    scope: "psalms",
    license: "Public Domain (published 1851)",
    attribution:
      "Sir Lancelot C. L. Brenton, The Septuagint Version of the Old Testament, 1851. Public domain. Verse file ctatum20/brenton-septuagint-data, confirmed against eBible.org (eng_Brenton).",
    format: "brenton_json",
    file: {
      url: `https://raw.githubusercontent.com/ctatum20/brenton-septuagint-data/${BRENTON_COMMIT}/_complete_brenton.json`,
      sha256: "185d16bed88eb4153ccdf54834a0fc6a5147b4a954b0824948199a0c1878d58d",
    },
    crossCheck: {
      ...ebible("corpus/eng-eng_Brenton.txt", "296869772fab5043fc3911c25db0d6034548a221e3a3feb7c3ab59fbe3994eaa"),
      minConfirmedRatio: 0.65,
    },
    allowedMissing: [],
  },
  {
    code: "GIGUET_LXX",
    name: "La Septante, traduction Giguet (1872)",
    language: "fr",
    textual_tradition: "septuagint",
    versification: "lxx",
    scope: "psalms",
    license: "Public Domain (published 1872)",
    attribution: "Pierre Giguet, La Sainte Bible traduite sur le texte grec des Septante, 1872. Domaine public, scrollmapper/bible_databases (FreLXXGiguet).",
    format: "scrollmapper_csv",
    file: {
      url: `https://raw.githubusercontent.com/scrollmapper/bible_databases/${SCROLLMAPPER_COMMIT}/formats/csv/FreLXXGiguet.csv`,
      sha256: "dfdfcf378a668a6a392eabb6bce503ef4bca7f55aded12ed5006a175c362ca3a",
    },
    allowedMissing: [],
  },
  {
    code: "BYZANTINE_GREEK",
    name: "Πατριαρχικὴ Ἔκδοσις 1904 (texte byzantin)",
    language: "grc",
    textual_tradition: "greek_byzantine",
    versification: "mt",
    scope: "nt",
    license: "Public Domain",
    attribution:
      "Greek New Testament, 1904 Patriarchal edition (Byzantine text) with 20 corrections from later editions. Public domain, eBible.org (grcbyz) via BibleNLP/ebible.",
    format: "vref",
    file: ebible("corpus/grc-grcbyz.txt", "8484ee60bdc1c28d009892bed6e97253f325c2baa6918cef269f800648868cf3"),
    allowedMissing: ["MRK 7:16", "ROM 16:25", "ROM 16:26", "ROM 16:27", "REV 12:18"],
  },
];

export const VERSION_BY_CODE = new Map(VERSIONS.map((v) => [v.code, v]));

/** Default reading versions per interface language and tradition. */
export const DEFAULT_VERSIONS = {
  fr: { common: "LSG1910", catholic: "LSG1910", orthodox: "LSG1910", psalms_catholic: "DRC", psalms_orthodox: "GIGUET_LXX" },
  en: { common: "WEB", catholic: "DRC", orthodox: "WEB", psalms_catholic: "DRC", psalms_orthodox: "BRENTON_LXX" },
} as const;

export const SELECTABLE_VERSIONS = {
  fr: ["LSG1910"],
  en: ["WEB", "KJV", "DRC"],
} as const;
