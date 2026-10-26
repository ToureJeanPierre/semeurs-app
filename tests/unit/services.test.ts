import { describe, expect, it } from "vitest";
import {
  countdownParts,
  formatTime,
  nextOccurrenceOf,
  nextService,
  weekProgramme,
  type ServiceType,
} from "@/lib/services";

const friday: ServiceType = {
  id: "fri",
  name: "Moment de prières et d'enseignements",
  short_name: "Culte du vendredi",
  weekday: 5,
  start_time: "18:00:00",
  end_time: "20:00:00",
  place: null,
};

const sunday: ServiceType = {
  id: "sun",
  name: "Culte d'actions de grâces",
  short_name: "Culte du dimanche",
  weekday: 0,
  start_time: "09:00:00",
  end_time: "12:00:00",
  place: null,
};

// Lundi 26 octobre 2026, 10 h à Abidjan (= UTC)
const monday = new Date("2026-10-26T10:00:00Z");

describe("nextOccurrenceOf", () => {
  it("trouve le prochain vendredi", () => {
    const occ = nextOccurrenceOf(friday, monday);
    expect(occ.startsAt.toISOString()).toBe("2026-10-30T18:00:00.000Z");
    expect(occ.endsAt.toISOString()).toBe("2026-10-30T20:00:00.000Z");
    expect(occ.inProgress).toBe(false);
  });

  it("signale un culte en cours", () => {
    const occ = nextOccurrenceOf(sunday, new Date("2026-11-01T10:30:00Z"));
    expect(occ.inProgress).toBe(true);
    expect(occ.startsAt.toISOString()).toBe("2026-11-01T09:00:00.000Z");
  });

  it("passe à la semaine suivante une fois le culte terminé", () => {
    const occ = nextOccurrenceOf(sunday, new Date("2026-11-01T12:00:00Z"));
    expect(occ.startsAt.toISOString()).toBe("2026-11-08T09:00:00.000Z");
  });

  it("garde le culte du jour s'il n'a pas commencé", () => {
    const occ = nextOccurrenceOf(sunday, new Date("2026-11-01T07:00:00Z"));
    expect(occ.startsAt.toISOString()).toBe("2026-11-01T09:00:00.000Z");
  });
});

describe("nextService", () => {
  it("choisit le plus proche", () => {
    expect(nextService([sunday, friday], monday)?.service.id).toBe("fri");
    expect(nextService([sunday, friday], new Date("2026-10-31T08:00:00Z"))?.service.id).toBe("sun");
  });

  it("préfère le culte en cours", () => {
    expect(nextService([friday, sunday], new Date("2026-10-30T19:00:00Z"))?.inProgress).toBe(true);
  });

  it("renvoie null sans culte paramétré", () => {
    expect(nextService([], monday)).toBeNull();
  });
});

describe("weekProgramme", () => {
  it("classe les cultes dans l'ordre chronologique", () => {
    expect(weekProgramme([sunday, friday], monday).map((o) => o.service.id)).toEqual(["fri", "sun"]);
  });
});

describe("countdownParts", () => {
  it("découpe le temps restant", () => {
    const target = new Date(monday.getTime() + ((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000);
    expect(countdownParts(target, monday)).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5 });
  });

  it("ne descend jamais sous zéro", () => {
    expect(countdownParts(monday, new Date(monday.getTime() + 1000))).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    });
  });
});

describe("formatTime", () => {
  it("écrit l'heure à la française", () => {
    expect(formatTime("09:00:00")).toBe("9 h");
    expect(formatTime("18:30")).toBe("18 h 30");
  });
});
