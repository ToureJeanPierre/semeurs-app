import { describe, expect, it } from "vitest";
import { daysUntilBirthday } from "@/lib/birthdays";

describe("daysUntilBirthday", () => {
  it("vaut 0 le jour même", () => {
    expect(daysUntilBirthday("1990-10-28", "2026-10-28")).toBe(0);
  });
  it("compte les jours jusqu'à la date de cette année", () => {
    expect(daysUntilBirthday("1985-11-02", "2026-10-28")).toBe(5);
  });
  it("passe à l'année suivante si la date est passée", () => {
    expect(daysUntilBirthday("2000-10-27", "2026-10-28")).toBe(364);
  });
  it("traverse le changement d'année", () => {
    expect(daysUntilBirthday("1970-01-02", "2026-12-30")).toBe(3);
  });
  it("29 février : fêté le 28 les années non bissextiles", () => {
    expect(daysUntilBirthday("2004-02-29", "2027-02-27")).toBe(1);
    expect(daysUntilBirthday("2004-02-29", "2028-02-28")).toBe(1);
  });
});
