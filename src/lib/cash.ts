/** Caisse et engagements (docs/01 §8.2-8.3) : calculs purs, testés. Montants en FCFA entiers. */

/** Total d'un comptage par coupures : {"10000": 3, "500": 4} → 32 000. */
export function countTotal(denominations: Record<string, number>): number {
  return Object.entries(denominations).reduce((sum, [value, count]) => sum + Number(value) * (Number.isFinite(count) && count > 0 ? Math.floor(count) : 0), 0);
}

export type PledgeState = "settled" | "late" | "due_soon" | "on_track";

export const PLEDGE_LABEL: Record<PledgeState, string> = {
  settled: "Soldé",
  late: "En retard",
  due_soon: "Échéance proche",
  on_track: "À jour",
};

/** État d'un engagement : soldé, en retard, échéance dans 7 jours, ou à jour. */
export function pledgeState(amount: number, paid: number, dueDate: string | null, today: string): PledgeState {
  if (paid >= amount) return "settled";
  if (!dueDate) return "on_track";
  if (dueDate < today) return "late";
  const days = Math.round((Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  return days <= 7 ? "due_soon" : "on_track";
}

/** Taux de réalisation (0-100, entier). */
export function rate(paid: number, promised: number): number {
  return promised > 0 ? Math.min(100, Math.round((paid / promised) * 100)) : 0;
}

/** Mois « AAAA-MM » précédent. */
export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
}

/** Premier et dernier jour d'un mois « AAAA-MM ». */
export function monthBounds(month: string): { first: string; last: string } {
  const [y, m] = month.split("-").map(Number);
  return { first: `${month}-01`, last: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) };
}

/** Ligne CSV (séparateur « ; », lisible par Excel en français). */
export function csvLine(values: (string | number | null | undefined)[]): string {
  return values
    .map((v) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[";\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
    })
    .join(";");
}
