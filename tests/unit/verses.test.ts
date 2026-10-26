import { describe, expect, it } from "vitest";
import { pickDailyVerse, type DailyVerse } from "@/lib/verses";

const verse = (position: number): DailyVerse => ({
  id: String(position),
  reference: `Réf ${position}`,
  text: "…",
  translation: "Louis Segond 1910",
  position,
});

describe("pickDailyVerse", () => {
  const verses = [verse(3), verse(1), verse(2)];

  it("garde le même verset toute la journée", () => {
    const morning = pickDailyVerse(verses, new Date("2026-10-26T00:00:01Z"));
    const night = pickDailyVerse(verses, new Date("2026-10-26T23:59:59Z"));
    expect(morning).toBe(night);
  });

  it("change de verset le lendemain et tourne dans l'ordre", () => {
    const days = [0, 1, 2, 3].map(
      (d) => pickDailyVerse(verses, new Date(Date.UTC(2026, 9, 26 + d, 12)))!.position,
    );
    expect(new Set(days.slice(0, 3)).size).toBe(3);
    expect(days[3]).toBe(days[0]);
    expect((days[1] - days[0] + 3) % 3).toBe(1);
  });

  it("renvoie null sans verset", () => {
    expect(pickDailyVerse([], new Date())).toBeNull();
  });
});
