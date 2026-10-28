/** Agenda des groupes : déroule les activités hebdomadaires sur une période (logique pure, testée). */

export type GroupEvent = {
  id: string;
  title: string;
  starts_at: string; // ISO
  ends_at: string | null;
  place: string | null;
  recurrence: "none" | "weekly";
  until: string | null; // AAAA-MM-JJ
  note: string | null;
};

export type Occurrence = GroupEvent & { date: string; startsAt: string; endsAt: string | null };

const DAY = 86_400_000;

/** Occurrences comprises entre `from` et `to` (dates AAAA-MM-JJ incluses), triées. */
export function expandEvents(events: GroupEvent[], from: string, to: string): Occurrence[] {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T23:59:59Z`);
  const out: Occurrence[] = [];
  for (const e of events) {
    const first = Date.parse(e.starts_at);
    const duration = e.ends_at ? Date.parse(e.ends_at) - first : null;
    const last = e.recurrence === "weekly" ? Math.min(end, e.until ? Date.parse(`${e.until}T23:59:59Z`) : end) : first;
    // Première occurrence utile : on saute les semaines entières déjà passées.
    let t = first;
    if (e.recurrence === "weekly" && t < start) t += Math.ceil((start - t) / (7 * DAY)) * 7 * DAY;
    for (; t <= last; t += 7 * DAY) {
      if (t >= start && t <= end) {
        const startsAt = new Date(t).toISOString();
        out.push({ ...e, date: startsAt.slice(0, 10), startsAt, endsAt: duration !== null ? new Date(t + duration).toISOString() : null });
      }
      if (e.recurrence !== "weekly") break;
    }
  }
  return out.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/** Libellés de postes saisis un par ligne (doublons et lignes vides retirés). */
export function parseLabels(text: string): string[] {
  return [...new Set(text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean))].slice(0, 30);
}

/** Nouveaux venus saisis un par ligne : « Nom Prénom 0707070707 » (le téléphone est facultatif). */
export function parseNewcomers(text: string): { last_name: string; first_name: string; phone: string | null }[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const phone = line.match(/(\+?225)?\s*0\d(?:[\s.]?\d{2}){4}/)?.[0] ?? null;
      const words = (phone ? line.replace(phone, "") : line).trim().split(/\s+/).filter(Boolean);
      return { last_name: words[0] ?? "", first_name: words.slice(1).join(" ") || "—", phone: phone ? phone.replace(/[\s.]/g, "") : null };
    })
    .filter((n) => n.last_name);
}
