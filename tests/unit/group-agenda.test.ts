import { describe, expect, it } from "vitest";
import { expandEvents, parseLabels, parseNewcomers, type GroupEvent } from "@/lib/group-agenda";

const weekly: GroupEvent = {
  id: "c",
  title: "Réunion de cellule",
  starts_at: "2026-09-01T18:00:00.000Z", // mardi
  ends_at: "2026-09-01T19:30:00.000Z",
  place: "Niangon",
  recurrence: "weekly",
  until: null,
  note: null,
};

describe("agenda des groupes", () => {
  it("déroule une activité hebdomadaire sur la période", () => {
    const occ = expandEvents([weekly], "2026-10-26", "2026-11-10");
    expect(occ.map((o) => o.date)).toEqual(["2026-10-27", "2026-11-03", "2026-11-10"]);
    expect(occ[0].endsAt).toBe("2026-10-27T19:30:00.000Z");
  });

  it("respecte la date de fin et les activités ponctuelles", () => {
    const once: GroupEvent = { ...weekly, id: "o", recurrence: "none", starts_at: "2026-11-05T10:00:00.000Z", ends_at: null };
    const occ = expandEvents([{ ...weekly, until: "2026-11-01" }, once], "2026-10-26", "2026-11-10");
    expect(occ.map((o) => `${o.id}:${o.date}`)).toEqual(["c:2026-10-27", "o:2026-11-05"]);
    expect(expandEvents([once], "2026-11-06", "2026-11-30")).toEqual([]);
  });

  it("lit les postes et les nouveaux venus saisis ligne par ligne", () => {
    expect(parseLabels("Accueil\n\nPlacement\nAccueil\n")).toEqual(["Accueil", "Placement"]);
    expect(parseNewcomers("Kouame Jean 07 08 09 10 11\nTraoré Awa\n")).toEqual([
      { last_name: "Kouame", first_name: "Jean", phone: "0708091011" },
      { last_name: "Traoré", first_name: "Awa", phone: null },
    ]);
  });
});
