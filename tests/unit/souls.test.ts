import { describe, expect, it } from "vitest";
import { isStepDone, nextStep, type Step } from "@/lib/souls";

const steps: Step[] = [
  { id: "1", code: "first_visit", label: "Fiche", position: 1, due_days: 0 },
  { id: "2", code: "welcome", label: "Bienvenue", position: 2, due_days: 0 },
  { id: "3", code: "call_72h", label: "Appel sous 72 h", position: 3, due_days: 3 },
  { id: "4", code: "family", label: "Famille", position: 4, due_days: 30 },
];

describe("parcours d'intégration", () => {
  it("donne la prochaine étape et signale le retard", () => {
    const soul = { steps: ["first_visit", "welcome"], in_family: false, in_team: false, arrived_at: "2026-10-20" };
    expect(nextStep(soul, steps, "2026-10-22")).toEqual({ step: steps[2], late: false });
    expect(nextStep(soul, steps, "2026-10-25")).toEqual({ step: steps[2], late: true });
  });

  it("constate l'intégration en famille sans case à cocher", () => {
    const soul = { steps: ["first_visit", "welcome", "call_72h"], in_family: true, in_team: false, arrived_at: "2026-10-01" };
    expect(isStepDone(soul, "family")).toBe(true);
    expect(nextStep(soul, steps, "2026-12-01")).toBeNull();
  });
});
