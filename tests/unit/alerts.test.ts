import { describe, expect, it } from "vitest";
import { barometer, byUrgency, needsContact } from "@/lib/alerts";

describe("alertes", () => {
  it("trie du plus urgent au moins urgent, puis par durée d'absence", () => {
    const rows = [
      { id: "a", level: "attention" as const, days_absent: 9 },
      { id: "b", level: "lost" as const, days_absent: 40 },
      { id: "c", level: "urgent" as const, days_absent: 15 },
      { id: "d", level: "urgent" as const, days_absent: 18 },
      { id: "e", level: "ok" as const, days_absent: 0 },
    ];
    expect(rows.sort(byUrgency).map((r) => r.id)).toEqual(["b", "d", "c", "a", "e"]);
  });

  it("à contacter : dès « Attention », pas les absences justifiées", () => {
    expect(needsContact("attention")).toBe(true);
    expect(needsContact("lost")).toBe(true);
    expect(needsContact("excused")).toBe(false);
    expect(needsContact("ok")).toBe(false);
  });

  it("compte les fidèles par couleur pour le baromètre", () => {
    expect(barometer(["ok", "excused", "attention", "urgent", "critical", "lost"])).toEqual({ red: 3, orange: 1, green: 2 });
  });
});
