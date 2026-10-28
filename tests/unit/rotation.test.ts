import { describe, expect, it } from "vitest";
import { assignRotation, datesBetween, dayKind, periodEnd, type PoolEntry, type Slot } from "@/lib/rotation";

const sundays = ["2026-11-01", "2026-11-08", "2026-11-15", "2026-11-22", "2026-11-29", "2026-12-06"];
const slotsFor = (dates: string[], label: string): Slot[] =>
  dates.map((date) => ({ key: `${date}-${label}`, date, label, personId: null }));

describe("roulement équitable", () => {
  it("répartit à parts égales entre les membres du vivier", () => {
    const pool: PoolEntry[] = ["a", "b", "c"].map((personId) => ({ personId, label: "Prédicateur", days: "both" }));
    const { assignments, unfilled } = assignRotation(slotsFor(sundays, "Prédicateur"), pool);
    expect(unfilled).toHaveLength(0);
    const counts = Object.groupBy(assignments, (a) => a.personId);
    expect(Object.values(counts).map((v) => v!.length)).toEqual([2, 2, 2]);
    // Jamais deux fois de suite la même personne.
    for (let i = 1; i < assignments.length; i++) expect(assignments[i].personId).not.toBe(assignments[i - 1].personId);
  });

  it("jamais deux postes le même jour, et les choix manuels sont gardés", () => {
    const pool: PoolEntry[] = [
      { personId: "a", label: "Modérateur", days: "both" },
      { personId: "a", label: "Prédicateur", days: "both" },
      { personId: "b", label: "Prédicateur", days: "both" },
    ];
    const slots: Slot[] = [
      { key: "m", date: "2026-11-01", label: "Modérateur", personId: null },
      { key: "p", date: "2026-11-01", label: "Prédicateur", personId: null },
    ];
    const { assignments } = assignRotation(slots, pool);
    expect(assignments).toEqual([
      { key: "m", personId: "a" },
      { key: "p", personId: "b" },
    ]);
    const kept = assignRotation([{ ...slots[1], personId: "a" }, slots[0]], pool);
    expect(kept.assignments).toEqual([]); // « a » prêche déjà ce jour-là : personne d'autre au vivier modérateur
    expect(kept.unfilled.map((s) => s.key)).toEqual(["m"]);
  });

  it("respecte les indisponibilités, le type de jour et l'historique", () => {
    const pool: PoolEntry[] = [
      { personId: "dim", label: "Modérateur", days: "sunday" },
      { personId: "sem", label: "Modérateur", days: "weekday" },
      { personId: "tous", label: "Modérateur", days: "both" },
    ];
    const slots: Slot[] = [
      { key: "ven", date: "2026-10-30", label: "Modérateur", personId: null }, // vendredi
      { key: "dim", date: "2026-11-01", label: "Modérateur", personId: null }, // dimanche
    ];
    const history = [{ personId: "sem", label: "Modérateur", date: "2026-10-23" }];
    const { assignments } = assignRotation(slots, pool, [{ personId: "dim", from: "2026-11-01", to: "2026-11-01" }], history);
    // Vendredi : « sem » a déjà servi, « tous » passe d'abord ; dimanche : « dim » est indisponible, « tous » a déjà servi le vendredi mais reste seul possible.
    expect(assignments).toEqual([
      { key: "ven", personId: "tous" },
      { key: "dim", personId: "tous" },
    ]);
  });

  it("signale les postes sans candidat", () => {
    const { unfilled } = assignRotation(slotsFor(["2026-11-01"], "Prédicateur"), []);
    expect(unfilled).toHaveLength(1);
  });
});

describe("calendrier", () => {
  it("reconnaît le dimanche", () => {
    expect(dayKind("2026-11-01")).toBe("sunday");
    expect(dayKind("2026-10-30")).toBe("weekday");
  });
  it("liste les vendredis et dimanches d'une période", () => {
    expect(datesBetween("2026-10-29", "2026-11-08", [5, 0])).toEqual(["2026-10-30", "2026-11-01", "2026-11-06", "2026-11-08"]);
  });
  it("calcule la fin d'une période de 2, 3 ou 6 mois", () => {
    expect(periodEnd("2026-11-01", 3)).toBe("2027-01-31");
    expect(periodEnd("2026-11-15", 2)).toBe("2027-01-14");
    expect(periodEnd("2026-08-31", 6)).toBe("2027-02-27");
  });
});
