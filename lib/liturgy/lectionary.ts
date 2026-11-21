/**
 * Builds liturgical uses from lectionary data files. Every description is
 * derived from the data (key of the celebration, date of the reading), never
 * written by hand per passage.
 *
 * - Roman rite: Sunday and feast lectionary, cycles A, B, C
 *   (LiturgicalCalendarAPI, dominicale_et_festivum_{A,B,C}/en.json).
 * - Byzantine rite: daily readings of the Greek Orthodox Archdiocese of
 *   America (orthocal-python, goarch_readings_2018_2027.json), Revised Julian
 *   calendar for fixed feasts, Paschal cycle from the Julian Pascha.
 */
import type { Range } from "@/lib/bible/reference";
import { daysBetween, fromIso, orthodoxPascha } from "./calendar";
import { parseCitation } from "./citation";

export type LiturgyRow = Range & {
  tradition: "catholic" | "orthodox";
  rite: "roman" | "byzantine";
  occasion_type: "sunday_cycle" | "feast" | "hours" | "kathisma" | "prokeimenon" | "other";
  description_fr: string;
  description_en: string;
  calendar: "gregorian" | "julian" | "revised_julian" | "none";
  season: string | null;
  key: string;
};

const ORD_FR = (n: number) => (n === 1 ? "1er" : `${n}e`);
const ORD_EN = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

type Occasion = { fr: string; en: string; type: LiturgyRow["occasion_type"]; season: string | null };

const FIXED: Record<string, Occasion> = {
  "Christmas.vigil": { fr: "Nativité du Seigneur, messe de la veille", en: "Nativity of the Lord, Vigil Mass", type: "feast", season: "avent-nativite" },
  "Christmas.night": { fr: "Nativité du Seigneur, messe de la nuit", en: "Nativity of the Lord, Mass during the Night", type: "feast", season: "avent-nativite" },
  "Christmas.dawn": { fr: "Nativité du Seigneur, messe de l'aurore", en: "Nativity of the Lord, Mass at Dawn", type: "feast", season: "avent-nativite" },
  "Christmas.day": { fr: "Nativité du Seigneur, messe du jour", en: "Nativity of the Lord, Mass during the Day", type: "feast", season: "avent-nativite" },
  HolyFamily: { fr: "Sainte Famille", en: "Holy Family", type: "feast", season: "avent-nativite" },
  MaryMotherOfGod: { fr: "Sainte Marie, Mère de Dieu (1er janvier)", en: "Mary, Mother of God (1 January)", type: "feast", season: "avent-nativite" },
  Christmas2: { fr: "2e dimanche après Noël", en: "Second Sunday after Christmas", type: "sunday_cycle", season: "avent-nativite" },
  Epiphany: { fr: "Épiphanie du Seigneur", en: "Epiphany of the Lord", type: "feast", season: "theophanie" },
  BaptismLord: { fr: "Baptême du Seigneur", en: "Baptism of the Lord", type: "feast", season: "theophanie" },
  PalmSun: { fr: "Dimanche des Rameaux et de la Passion", en: "Palm Sunday of the Passion of the Lord", type: "sunday_cycle", season: "semaine-sainte" },
  HolyThursChrism: { fr: "Jeudi saint, messe chrismale", en: "Holy Thursday, Chrism Mass", type: "feast", season: "semaine-sainte" },
  HolyThurs: { fr: "Jeudi saint, messe en mémoire de la Cène du Seigneur", en: "Holy Thursday, Mass of the Lord's Supper", type: "feast", season: "semaine-sainte" },
  GoodFri: { fr: "Vendredi saint, célébration de la Passion", en: "Good Friday, Celebration of the Passion", type: "feast", season: "semaine-sainte" },
  EasterVigil: { fr: "Vigile pascale", en: "Easter Vigil", type: "feast", season: "paques-pascha" },
  "Easter.day": { fr: "Dimanche de Pâques, messe du jour", en: "Easter Sunday, Mass during the Day", type: "feast", season: "paques-pascha" },
  "Easter.evening": { fr: "Dimanche de Pâques, messe du soir", en: "Easter Sunday, Evening Mass", type: "feast", season: "paques-pascha" },
  Ascension: { fr: "Ascension du Seigneur", en: "Ascension of the Lord", type: "feast", season: "ascension" },
  "Pentecost.vigil": { fr: "Pentecôte, messe de la veille", en: "Pentecost, Vigil Mass", type: "feast", season: "pentecote" },
  "Pentecost.day": { fr: "Pentecôte, messe du jour", en: "Pentecost, Mass during the Day", type: "feast", season: "pentecote" },
  Trinity: { fr: "Sainte Trinité", en: "Most Holy Trinity", type: "feast", season: "temps-ordinaire" },
  JesusChristEternalHighPriest: { fr: "Notre-Seigneur Jésus-Christ, souverain et éternel prêtre", en: "Our Lord Jesus Christ, the Eternal High Priest", type: "feast", season: "temps-ordinaire" },
  CorpusChristi: { fr: "Saint-Sacrement du Corps et du Sang du Christ", en: "Most Holy Body and Blood of Christ", type: "feast", season: "temps-ordinaire" },
  SacredHeart: { fr: "Sacré-Cœur de Jésus", en: "Most Sacred Heart of Jesus", type: "feast", season: "temps-ordinaire" },
  ChristKing: { fr: "Christ, Roi de l'univers", en: "Christ the King", type: "feast", season: "temps-ordinaire" },
};

export function romanOccasion(key: string): Occasion | null {
  if (FIXED[key]) return FIXED[key]!;
  const m = /^(Advent|Lent|Easter|OrdSunday)(\d+)$/.exec(key);
  if (!m) return null;
  const n = Number(m[2]);
  switch (m[1]) {
    case "Advent":
      return { fr: `${ORD_FR(n)} dimanche de l'Avent`, en: `${ORD_EN(n)} Sunday of Advent`, type: "sunday_cycle", season: "avent-nativite" };
    case "Lent":
      return { fr: `${ORD_FR(n)} dimanche de Carême`, en: `${ORD_EN(n)} Sunday of Lent`, type: "sunday_cycle", season: "careme-triode" };
    case "Easter":
      return { fr: `${ORD_FR(n)} dimanche de Pâques`, en: `${ORD_EN(n)} Sunday of Easter`, type: "sunday_cycle", season: "paques-pascha" };
    default:
      return { fr: `${ORD_FR(n)} dimanche du temps ordinaire`, en: `${ORD_EN(n)} Sunday in Ordinary Time`, type: "sunday_cycle", season: "temps-ordinaire" };
  }
}

const FIELD: Record<string, { fr: string; en: string }> = {
  gospel: { fr: "Évangile", en: "Gospel" },
  palm_gospel: { fr: "Évangile de la procession des Rameaux", en: "Gospel of the procession with palms" },
  second_reading: { fr: "Deuxième lecture", en: "Second reading" },
  epistle: { fr: "Épître", en: "Epistle" },
  first_reading: { fr: "Première lecture", en: "First reading" },
};

function fieldLabel(field: string): { fr: string; en: string } | null {
  if (FIELD[field]) return FIELD[field]!;
  if (field.startsWith("responsorial_psalm")) return { fr: "Psaume responsorial", en: "Responsorial psalm" };
  if (field.endsWith("_reading")) return { fr: "Lecture", en: "Reading" };
  return null;
}

/** Rows for one Roman lectionary file (one Sunday cycle). */
export function romanRows(data: Record<string, unknown>, cycle: "A" | "B" | "C"): { rows: LiturgyRow[]; skipped: string[] } {
  const rows: LiturgyRow[] = [];
  const skipped: string[] = [];
  const visit = (key: string, entry: Record<string, unknown>) => {
    const occasion = romanOccasion(key);
    if (!occasion) return void skipped.push(key);
    for (const [field, value] of Object.entries(entry)) {
      if (typeof value !== "string" || !value.trim() || field === "gospel_acclamation") continue;
      const label = fieldLabel(field);
      if (!label) continue;
      for (const range of parseCitation(value) ?? []) {
        rows.push({
          ...range,
          tradition: "catholic",
          rite: "roman",
          occasion_type: occasion.type,
          description_fr: `${label.fr} · ${occasion.fr}, année ${cycle} (lectionnaire romain)`,
          description_en: `${label.en} · ${occasion.en}, Year ${cycle} (Roman Lectionary)`,
          calendar: "gregorian",
          season: occasion.season,
          key: `${cycle}:${key}:${field}`,
        });
      }
    }
  };
  for (const [key, value] of Object.entries(data)) {
    if (!value || typeof value !== "object") continue;
    const entry = value as Record<string, unknown>;
    if (Object.values(entry).some((v) => v && typeof v === "object")) {
      for (const [sub, inner] of Object.entries(entry)) if (inner && typeof inner === "object") visit(`${key}.${sub}`, inner as Record<string, unknown>);
    } else visit(key, entry);
  }
  return { rows, skipped };
}

const BYZ_TYPE: Record<string, { fr: string; en: string }> = {
  G: { fr: "Évangile de la Divine Liturgie", en: "Gospel of the Divine Liturgy" },
  E: { fr: "Épître de la Divine Liturgie", en: "Epistle of the Divine Liturgy" },
  MG: { fr: "Évangile des Matines (Orthros)", en: "Matins (Orthros) Gospel" },
};

function paschalSeason(offset: number): string | null {
  if (offset >= -70 && offset < -7) return "careme-triode";
  if (offset >= -7 && offset < 0) return "semaine-sainte";
  if (offset >= 0 && offset < 39) return "paques-pascha";
  if (offset >= 39 && offset < 49) return "ascension";
  if (offset >= 49 && offset <= 56) return "pentecote";
  return null;
}

/** Rows for the GOARCH readings of the given years (Sundays and feast-bearing days only, see `keep`). */
export function byzantineRows(data: Record<string, unknown>, years: number[], keep: (iso: string, weekdayIndex: number) => boolean): LiturgyRow[] {
  const rows: LiturgyRow[] = [];
  const fmt = (iso: string, locale: string) =>
    new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
  for (const [iso, value] of Object.entries(data)) {
    if (iso.startsWith("_") || !years.includes(Number(iso.slice(0, 4)))) continue;
    const weekdayIndex = new Date(`${iso}T12:00:00Z`).getUTCDay();
    if (!keep(iso, weekdayIndex)) continue;
    const readings = (value as [string, [string, string][]])[1];
    const date = fromIso(iso);
    const offset = daysBetween(orthodoxPascha(date.year), date);
    const paschal = offset === 0 ? { fr: " · Pascha", en: " · Pascha" } : Math.abs(offset) <= 56 ? { fr: ` · ${offset > 0 ? "Pascha + " : "Pascha − "}${Math.abs(offset)} jours`, en: ` · Pascha ${offset > 0 ? "+" : "−"} ${Math.abs(offset)} days` } : { fr: "", en: "" };
    for (const [type, citation] of readings) {
      const label = BYZ_TYPE[type];
      if (!label) continue;
      for (const range of parseCitation(citation) ?? []) {
        rows.push({
          ...range,
          tradition: "orthodox",
          rite: "byzantine",
          occasion_type: offset === 0 || weekdayIndex !== 0 ? "feast" : "other",
          description_fr: `${label.fr} · ${fmt(iso, "fr-FR")}${paschal.fr} (Archidiocèse grec orthodoxe d'Amérique)`,
          description_en: `${label.en} · ${fmt(iso, "en-GB")}${paschal.en} (Greek Orthodox Archdiocese of America)`,
          calendar: "revised_julian",
          season: paschalSeason(offset),
          key: `${iso}:${type}:${citation}`,
        });
      }
    }
  }
  return rows;
}
