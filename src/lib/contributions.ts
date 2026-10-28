/**
 * Cotisations (docs/01 §8.1) : calculs purs, testés (tests/unit/contributions.test.ts).
 * Les montants sont des entiers en FCFA.
 */

export type Heading = {
  id: string;
  title: string;
  kind: string;
  description: string | null;
  group_id: string | null;
  beneficiary_id: string | null;
  amount_mode: "fixed" | "free";
  amount: number | null;
  min_amount: number | null;
  target_amount: number | null;
  recurrence: "none" | "monthly";
  starts_on: string;
  due_date: string | null;
  status: "open" | "closed";
};

export type Payment = {
  id: string;
  heading_id: string;
  person_id: string;
  amount: number;
  method: string;
  reference: string | null;
  period: string | null;
  status: "declared" | "validated" | "rejected";
  receipt_no: string | null;
  reverses_id: string | null;
  reason: string | null;
  created_at: string;
  validated_at: string | null;
};

export type MemberStatus = {
  person_id: string;
  name: string;
  first_name: string;
  phone: string | null;
  expected: number | null;
  paid: number;
  declared: number;
  state: "paid" | "partial" | "unpaid";
};

/** Total encaissé (versements validés, annulations déduites). */
export function collected(payments: Pick<Payment, "amount" | "status">[]): number {
  return payments.filter((p) => p.status === "validated").reduce((sum, p) => sum + p.amount, 0);
}

/** Versements validés qui ont été annulés par une contre-opération. */
export function reversedIds(payments: Pick<Payment, "reverses_id">[]): Set<string> {
  return new Set(payments.map((p) => p.reverses_id).filter((id): id is string => Boolean(id)));
}

/** Avancement vers l'objectif, en pourcentage entier (plafonné à 100). */
export function progress(total: number, target: number | null): number | null {
  if (!target) return null;
  return Math.max(0, Math.min(100, Math.round((total / target) * 100)));
}

/** Ce que doit encore une personne (mode fixe), jamais négatif. */
export function remaining(expected: number | null, paid: number): number {
  return expected ? Math.max(0, expected - paid) : 0;
}

/** Répartition par moyen de paiement (versements validés). */
export function byMethod(payments: Pick<Payment, "amount" | "status" | "method">[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of payments) if (p.status === "validated") out[p.method] = (out[p.method] ?? 0) + p.amount;
  return out;
}

/** Résumé des personnes attendues : combien ont payé, en partie, pas du tout. */
export function summarize(rows: Pick<MemberStatus, "state">[]) {
  return {
    paid: rows.filter((r) => r.state === "paid").length,
    partial: rows.filter((r) => r.state === "partial").length,
    unpaid: rows.filter((r) => r.state === "unpaid").length,
  };
}

/** Mois « AAAA-MM » courant et les précédents (cotisations mensuelles). */
export function recentPeriods(today: string, count = 6): string[] {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return d.toISOString().slice(0, 7);
  });
}

/** Lecture d'un montant saisi (« 25 000 », « 25000 F ») ; null si invalide. */
export function parseAmount(text: string): number | null {
  const digits = text.replace(/[\s .]/g, "").replace(/(f|fcfa|cfa)$/i, "");
  if (!/^\d+$/.test(digits)) return null;
  const n = Number(digits);
  return n > 0 && n <= 100_000_000 ? n : null;
}

const UNITS = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize"];
const TENS = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante"];

function below100(n: number): string {
  if (n <= 16) return UNITS[n];
  if (n < 20) return `dix-${UNITS[n - 10]}`;
  if (n < 70) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    return u === 0 ? TENS[t] : u === 1 ? `${TENS[t]} et un` : `${TENS[t]}-${UNITS[u]}`;
  }
  if (n < 80) return n === 71 ? "soixante et onze" : `soixante-${below100(n - 60)}`;
  if (n === 80) return "quatre-vingts";
  return `quatre-vingt-${below100(n - 80)}`;
}

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const hundreds = h === 0 ? "" : h === 1 ? "cent" : `${UNITS[h]} cent${r === 0 ? "s" : ""}`;
  if (r === 0) return hundreds || "zéro";
  return hundreds ? `${hundreds} ${below100(r)}` : below100(r);
}

/** Montant en lettres pour les reçus (orthographe traditionnelle) : 25 000 → « vingt-cinq mille ». */
export function amountInWords(amount: number): string {
  const n = Math.floor(Math.abs(amount));
  if (n === 0) return "zéro";
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (millions) parts.push(`${below1000(millions)} million${millions > 1 ? "s" : ""}`);
  if (thousands) parts.push(thousands === 1 ? "mille" : `${below1000(thousands).replace(/cents$/, "cent").replace(/vingts$/, "vingt")} mille`);
  if (rest) parts.push(below1000(rest));
  return parts.join(" ");
}
