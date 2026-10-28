/**
 * Formats d'affichage communs (français de Côte d'Ivoire). Abidjan vit à l'heure UTC
 * toute l'année : les dates « AAAA-MM-JJ » et les heures sont affichées en UTC.
 */
const TZ = "UTC";

const longDay = new Intl.DateTimeFormat("fr-CI", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
const shortDay = new Intl.DateTimeFormat("fr-CI", { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
const fullDate = new Intl.DateTimeFormat("fr-CI", { day: "numeric", month: "long", year: "numeric", timeZone: TZ });
const monthYear = new Intl.DateTimeFormat("fr-CI", { month: "long", year: "numeric", timeZone: TZ });
const money = new Intl.NumberFormat("fr-CI", { maximumFractionDigits: 0 });

const asDate = (value: string | Date) => (typeof value === "string" && value.length === 10 ? new Date(`${value}T00:00:00Z`) : new Date(value));

/** « dimanche 1 novembre » */
export const formatLongDay = (value: string | Date) => longDay.format(asDate(value));
/** « dim. 1 nov. » */
export const formatShortDay = (value: string | Date) => shortDay.format(asDate(value));
/** « 1 novembre 2026 » */
export const formatFullDate = (value: string | Date) => fullDate.format(asDate(value));
/** « novembre 2026 » */
export const formatMonth = (value: string | Date) => monthYear.format(asDate(value));

/** « 18 h » ou « 9 h 30 » (espaces insécables pour ne jamais couper). */
export function formatHour(value: string | Date): string {
  const d = asDate(value);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

/** « 25 000 FCFA » (espace insécable entre milliers et avant la devise). */
export function formatMoney(amount: number): string {
  return `${money.format(amount).replace(/\s/g, " ")} FCFA`;
}

/** Date du jour à Abidjan, « AAAA-MM-JJ ». */
export function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Ajoute des jours à une date « AAAA-MM-JJ ». */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
