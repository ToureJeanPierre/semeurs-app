/** Parcours d'intégration des âmes (docs/01 §7) : logique pure, testée. */

export type Step = { id: string; code: string; label: string; position: number; due_days: number | null };

export type Soul = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  status: string;
  arrived_at: string | null;
  brought_by: string | null;
  brought_by_name: string | null;
  assignees: string[];
  steps: string[];
  in_family: boolean;
  in_team: boolean;
  last_contact: string | null;
};

/** Une étape est faite si elle est cochée ; « famille » et « équipe » se constatent aussi d'elles-mêmes. */
export function isStepDone(soul: Pick<Soul, "steps" | "in_family" | "in_team">, code: string): boolean {
  return soul.steps.includes(code) || (code === "family" && soul.in_family) || (code === "team" && soul.in_team);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Première étape non faite, et si son délai conseillé (depuis l'arrivée) est dépassé. */
export function nextStep(
  soul: Pick<Soul, "steps" | "in_family" | "in_team" | "arrived_at">,
  steps: Step[],
  today: string,
): { step: Step; late: boolean } | null {
  const step = [...steps].sort((a, b) => a.position - b.position).find((s) => !isStepDone(soul, s.code));
  if (!step) return null;
  const late = step.due_days !== null && soul.arrived_at !== null && daysBetween(soul.arrived_at, today) > step.due_days;
  return { step, late };
}
