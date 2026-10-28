/**
 * Roulement équitable (docs/02 §6.2) : sert au programme des cultes (modérateurs,
 * prédicateurs) et au planning de service des groupes (protocole, chaîne de prière…).
 *
 * Règles, dans l'ordre :
 * 1. on ne touche jamais un poste déjà attribué (les choix manuels sont gardés) ;
 * 2. seules les personnes du vivier du poste, pour ce type de jour, sont candidates ;
 * 3. indisponibilités respectées ; jamais deux postes le même jour pour la même personne ;
 * 4. le moins sollicité d'abord (historique compris), puis celui qui a servi il y a le plus longtemps ;
 * 5. à égalité, un ordre mélangé mais reproductible (pas l'ordre alphabétique, qui avantagerait toujours les mêmes).
 */

export type DayKind = "sunday" | "weekday";
export type PoolDays = DayKind | "both";

export type Slot = {
  key: string; // identifiant du poste à pourvoir (ex. id de service_positions)
  date: string; // AAAA-MM-JJ
  label: string; // libellé du poste (« Prédicateur »)
  personId: string | null; // titulaire actuel (null = à pourvoir)
};

export type PoolEntry = { personId: string; label: string; days: PoolDays };
export type Unavailability = { personId: string; from: string; to: string };
/** Passages déjà faits (avant la période) : comptent pour l'équité. */
export type PastAssignment = { personId: string; label: string; date: string };

export type RotationResult = {
  assignments: { key: string; personId: string }[];
  /** Postes restés vides faute de candidat. */
  unfilled: Slot[];
};

export function dayKind(date: string): DayKind {
  return new Date(`${date}T00:00:00Z`).getUTCDay() === 0 ? "sunday" : "weekday";
}

/** Petit hachage stable (FNV-1a) pour départager sans favoriser personne. */
function tieBreak(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function assignRotation(
  slots: Slot[],
  pool: PoolEntry[],
  unavailable: Unavailability[] = [],
  history: PastAssignment[] = [],
): RotationResult {
  const counts = new Map<string, number>(); // `${label}|${personId}` → nombre de passages
  const last = new Map<string, string>(); // `${label}|${personId}` → dernière date
  const busy = new Set<string>(); // `${date}|${personId}` : déjà pris ce jour-là
  const bump = (label: string, personId: string, date: string) => {
    const k = `${label}|${personId}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
    if (!last.has(k) || last.get(k)! < date) last.set(k, date);
  };

  for (const h of history) bump(h.label, h.personId, h.date);
  for (const s of slots) {
    if (s.personId) {
      bump(s.label, s.personId, s.date);
      busy.add(`${s.date}|${s.personId}`);
    }
  }

  const ordered = [...slots].sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
  const assignments: RotationResult["assignments"] = [];
  const unfilled: Slot[] = [];

  for (const slot of ordered) {
    if (slot.personId) continue;
    const kind = dayKind(slot.date);
    const candidates = pool.filter(
      (p) =>
        p.label === slot.label &&
        (p.days === "both" || p.days === kind) &&
        !busy.has(`${slot.date}|${p.personId}`) &&
        !unavailable.some((u) => u.personId === p.personId && u.from <= slot.date && slot.date <= u.to),
    );
    if (candidates.length === 0) {
      unfilled.push(slot);
      continue;
    }
    candidates.sort((a, b) => {
      const ka = `${slot.label}|${a.personId}`;
      const kb = `${slot.label}|${b.personId}`;
      return (
        (counts.get(ka) ?? 0) - (counts.get(kb) ?? 0) ||
        (last.get(ka) ?? "").localeCompare(last.get(kb) ?? "") ||
        tieBreak(ka) - tieBreak(kb)
      );
    });
    const chosen = candidates[0].personId;
    assignments.push({ key: slot.key, personId: chosen });
    bump(slot.label, chosen, slot.date);
    busy.add(`${slot.date}|${chosen}`);
  }
  return { assignments, unfilled };
}

/** Dates d'une période (début inclus, fin incluse) qui tombent sur l'un des jours de la semaine donnés (0 = dimanche). */
export function datesBetween(from: string, to: string, weekdays: number[]): string[] {
  const out: string[] = [];
  const end = new Date(`${to}T00:00:00Z`);
  for (let d = new Date(`${from}T00:00:00Z`); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    if (weekdays.includes(d.getUTCDay())) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** Fin d'une période de `months` mois commençant à `from` (veille du même jour, `months` mois plus tard). */
export function periodEnd(from: string, months: number): string {
  const d = new Date(`${from}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
