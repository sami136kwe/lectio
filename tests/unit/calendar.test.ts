import { describe, expect, it } from "vitest";
import {
  addDays,
  byzantineSeason,
  fromIso,
  gregorianToJdn,
  jdnToGregorian,
  julianToGregorian,
  orthodoxPascha,
  orthodoxPaschaJulian,
  romanSeason,
  toIso,
  westernEaster,
  weekday,
} from "@/lib/liturgy/calendar";

// Published dates of Easter (Gregorian) and Orthodox Pascha (Gregorian civil date).
const KNOWN: [number, string, string][] = [
  [2000, "2000-04-23", "2000-04-30"],
  [2017, "2017-04-16", "2017-04-16"],
  [2019, "2019-04-21", "2019-04-28"],
  [2021, "2021-04-04", "2021-05-02"],
  [2022, "2022-04-17", "2022-04-24"],
  [2023, "2023-04-09", "2023-04-16"],
  [2024, "2024-03-31", "2024-05-05"],
  [2025, "2025-04-20", "2025-04-20"],
  [2026, "2026-04-05", "2026-04-12"],
  [2027, "2027-03-28", "2027-05-02"],
];

describe("Easter and Pascha", () => {
  it.each(KNOWN)("%i: Easter %s, Pascha %s", (year, west, east) => {
    expect(toIso(westernEaster(year))).toBe(west);
    expect(toIso(orthodoxPascha(year))).toBe(east);
  });

  it("handles the extreme Gregorian dates", () => {
    expect(toIso(westernEaster(1818))).toBe("1818-03-22");
    expect(toIso(westernEaster(2285))).toBe("2285-03-22");
    expect(toIso(westernEaster(1943))).toBe("1943-04-25");
  });

  it("always falls on a Sunday, for both calendars", () => {
    for (let y = 1900; y <= 2099; y++) {
      expect(weekday(westernEaster(y))).toBe(0);
      expect(weekday(orthodoxPascha(y))).toBe(0);
    }
  });

  it("gives the Julian date before conversion (2024: 22 April Julian = 5 May Gregorian)", () => {
    expect(toIso(orthodoxPaschaJulian(2024))).toBe("2024-04-22");
  });
});

describe("calendar conversion", () => {
  it("shifts 13 days between 1900 and 2099", () => {
    expect(toIso(julianToGregorian({ year: 2024, month: 12, day: 25 }))).toBe("2025-01-07");
    expect(toIso(julianToGregorian({ year: 2000, month: 1, day: 1 }))).toBe("2000-01-14");
  });

  it("shifts 10 days at the 1582 reform", () => {
    expect(toIso(julianToGregorian({ year: 1582, month: 10, day: 5 }))).toBe("1582-10-15");
  });

  it("round-trips through Julian Day Numbers", () => {
    expect(gregorianToJdn({ year: 2000, month: 1, day: 1 })).toBe(2451545);
    for (const iso of ["1600-02-29", "1900-03-01", "2024-02-29", "2099-12-31"]) expect(toIso(jdnToGregorian(gregorianToJdn(fromIso(iso))))).toBe(iso);
    expect(toIso(addDays(fromIso("2024-02-28"), 2))).toBe("2024-03-01");
  });
});

describe("seasons", () => {
  it("places Roman rite dates", () => {
    expect(romanSeason(fromIso("2024-12-01"))).toBe("avent-nativite"); // First Sunday of Advent 2024
    expect(romanSeason(fromIso("2024-11-30"))).toBe("temps-ordinaire");
    expect(romanSeason(fromIso("2025-01-02"))).toBe("avent-nativite");
    expect(romanSeason(fromIso("2025-01-12"))).toBe("theophanie"); // Baptism of the Lord 2025
    expect(romanSeason(fromIso("2025-01-13"))).toBe("temps-ordinaire");
    expect(romanSeason(fromIso("2025-03-05"))).toBe("careme-triode"); // Ash Wednesday 2025
    expect(romanSeason(fromIso("2025-04-13"))).toBe("semaine-sainte"); // Palm Sunday
    expect(romanSeason(fromIso("2025-04-20"))).toBe("paques-pascha");
    expect(romanSeason(fromIso("2025-05-29"))).toBe("ascension");
    expect(romanSeason(fromIso("2025-06-08"))).toBe("pentecote");
  });

  it("places Byzantine rite dates on the Julian calendar", () => {
    expect(byzantineSeason(fromIso("2024-05-05"))).toBe("paques-pascha");
    expect(byzantineSeason(fromIso("2024-04-28"))).toBe("semaine-sainte");
    expect(byzantineSeason(fromIso("2024-03-18"))).toBe("careme-triode"); // Clean Monday 2024
    expect(byzantineSeason(fromIso("2025-01-07"))).toBe("avent-nativite"); // Nativity, 25 Dec Julian
    expect(byzantineSeason(fromIso("2025-01-19"))).toBe("theophanie"); // 6 Jan Julian
    expect(byzantineSeason(fromIso("2025-01-06"), "revised_julian")).toBe("theophanie");
    expect(byzantineSeason(fromIso("2025-08-10"))).toBe("temps-ordinaire");
  });
});
