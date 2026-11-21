/**
 * Calendar computations for the liturgical year. No dates are typed by hand:
 *
 * - Western Easter: Meeus/Jones/Butcher algorithm, Gregorian calendar.
 * - Orthodox Pascha: Meeus's Julian algorithm, giving a Julian calendar date,
 *   converted to the Gregorian civil date through Julian Day Numbers.
 *
 * Both are tested against published dates (tests/unit/calendar.test.ts).
 */

export type YMD = { year: number; month: number; day: number };

/** Gregorian Easter Sunday (Meeus/Jones/Butcher, valid for 1583 onwards). */
export function westernEaster(year: number): YMD {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { year, month, day };
}

/** Orthodox Pascha as a Julian calendar date (Meeus's Julian algorithm). */
export function orthodoxPaschaJulian(year: number): YMD {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  return { year, month, day };
}

/** Julian Day Number of a Julian calendar date. */
export function julianToJdn({ year, month, day }: YMD): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
}

/** Julian Day Number of a Gregorian calendar date. */
export function gregorianToJdn({ year, month, day }: YMD): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

/** Gregorian calendar date of a Julian Day Number. */
export function jdnToGregorian(jdn: number): YMD {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    day: e - Math.floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * Math.floor(m / 10),
    year: 100 * b + d - 4800 + Math.floor(m / 10),
  };
}

export function julianToGregorian(date: YMD): YMD {
  return jdnToGregorian(julianToJdn(date));
}

/** Orthodox Pascha as a Gregorian civil date (what a Gregorian wall calendar shows). */
export function orthodoxPascha(year: number): YMD {
  return julianToGregorian(orthodoxPaschaJulian(year));
}

export function toIso({ year, month, day }: YMD): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function fromIso(iso: string): YMD {
  const [year, month, day] = iso.split("-").map(Number) as [number, number, number];
  return { year, month, day };
}

export function addDays(date: YMD, days: number): YMD {
  return jdnToGregorian(gregorianToJdn(date) + days);
}

export function daysBetween(a: YMD, b: YMD): number {
  return gregorianToJdn(b) - gregorianToJdn(a);
}

/** Day of the week, 0 = Sunday. */
export function weekday(date: YMD): number {
  return (gregorianToJdn(date) + 1) % 7;
}

export type SeasonSlug =
  | "avent-nativite"
  | "theophanie"
  | "careme-triode"
  | "semaine-sainte"
  | "paques-pascha"
  | "ascension"
  | "pentecote"
  | "temps-ordinaire";

/**
 * Roman rite season of a Gregorian date. Boundaries follow the General Norms
 * for the Liturgical Year: Advent starts on the fourth Sunday before Christmas,
 * Christmas time ends with the Baptism of the Lord (Sunday after 6 January),
 * Lent starts on Ash Wednesday (Easter - 46), Holy Week starts on Palm Sunday,
 * Easter time ends at Pentecost (Easter + 49); Ascension is Easter + 39.
 */
export function romanSeason(date: YMD): SeasonSlug {
  const easter = westernEaster(date.year);
  const offset = daysBetween(easter, date);
  if (offset >= -46 && offset < -7) return "careme-triode";
  if (offset >= -7 && offset < 0) return "semaine-sainte";
  if (offset >= 0 && offset < 39) return "paques-pascha";
  if (offset >= 39 && offset < 49) return "ascension";
  if (offset === 49) return "pentecote";
  const christmas = { year: date.year, month: 12, day: 25 };
  const adventStart = addDays(christmas, -(weekday(christmas) === 0 ? 28 : 21 + weekday(christmas)));
  if (daysBetween(adventStart, date) >= 0) return "avent-nativite";
  // Baptism of the Lord: Sunday after 6 January (7-13 January); Christmas time ends that day.
  const jan6 = { year: date.year, month: 1, day: 6 };
  const baptism = addDays(jan6, 7 - weekday(jan6) || 7);
  const fromBaptism = daysBetween(baptism, date);
  if (date.month === 1 && date.day >= 6 && fromBaptism <= 0) return "theophanie";
  if (fromBaptism < 0) return "avent-nativite";
  return "temps-ordinaire";
}

/**
 * Byzantine rite season, on the Julian calendar (the dates are given as the
 * Gregorian civil date). Triodion starts ten weeks before Pascha (Sunday of
 * the Publican and the Pharisee), Holy Week on Palm Sunday, the Pentecostarion
 * ends with All Saints (Pascha + 56). The Nativity fast runs 15 November -
 * 24 December (Julian), the Nativity-Theophany period until 6 January (Julian).
 */
export function byzantineSeason(date: YMD, calendar: "julian" | "revised_julian" = "julian"): SeasonSlug {
  const pascha = orthodoxPascha(date.year);
  const offset = daysBetween(pascha, date);
  if (offset >= -70 && offset < -7) return "careme-triode";
  if (offset >= -7 && offset < 0) return "semaine-sainte";
  if (offset >= 0 && offset < 39) return "paques-pascha";
  if (offset >= 39 && offset < 49) return "ascension";
  if (offset >= 49 && offset <= 56) return "pentecote";
  // Fixed feasts: the Julian calendar is 13 days behind the Gregorian one from 1900 to 2099.
  // The revised Julian calendar keeps fixed feasts on the Gregorian date.
  const shift = calendar === "julian" ? daysBetween(julianToGregorian({ year: date.year, month: 1, day: 1 }), { year: date.year, month: 1, day: 1 }) : 0;
  const fixed = addDays(date, shift);
  const md = fixed.month * 100 + fixed.day;
  if (md >= 1115 || md < 106) return "avent-nativite";
  if (md === 106) return "theophanie";
  return "temps-ordinaire";
}
