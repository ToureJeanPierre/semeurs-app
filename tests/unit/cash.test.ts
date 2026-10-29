import { describe, expect, it } from "vitest";
import { countTotal, csvLine, monthBounds, pledgeState, previousMonth, rate } from "@/lib/cash";

describe("caisse", () => {
  it("additionne un comptage par coupures, en ignorant les saisies invalides", () => {
    expect(countTotal({ "10000": 3, "5000": 1, "500": 4, "25": 2 })).toBe(37050);
    expect(countTotal({ "10000": -1, "1000": Number.NaN, "200": 1.7 })).toBe(200);
  });

  it("donne l'état d'un engagement", () => {
    expect(pledgeState(100000, 100000, "2026-11-01", "2026-12-01")).toBe("settled");
    expect(pledgeState(100000, 50000, "2026-11-01", "2026-11-02")).toBe("late");
    expect(pledgeState(100000, 50000, "2026-11-05", "2026-11-01")).toBe("due_soon");
    expect(pledgeState(100000, 0, "2026-12-31", "2026-11-01")).toBe("on_track");
    expect(pledgeState(100000, 0, null, "2026-11-01")).toBe("on_track");
    expect(rate(75000, 100000)).toBe(75);
    expect(rate(10, 0)).toBe(0);
  });

  it("calcule les mois et exporte proprement pour Excel", () => {
    expect(previousMonth("2026-01")).toBe("2025-12");
    expect(monthBounds("2026-02")).toEqual({ first: "2026-02-01", last: "2026-02-28" });
    expect(csvLine(["Offrande", 5000, null, 'Don "spécial"; merci'])).toBe('Offrande;5000;;"Don ""spécial""; merci"');
  });
});
