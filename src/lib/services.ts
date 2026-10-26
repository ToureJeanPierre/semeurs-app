/**
 * Calendrier des cultes récurrents (docs/01 §10.1).
 *
 * Abidjan vit à l'heure UTC toute l'année (pas d'heure d'été) : une heure
 * « 09:00 » en base correspond donc à 09:00 UTC. Les calculs se font en UTC.
 */

export type ServiceType = {
  id: string;
  name: string;
  short_name: string | null;
  weekday: number; // 0 = dimanche … 6 = samedi
  start_time: string; // « HH:MM » ou « HH:MM:SS »
  end_time: string;
  place: string | null;
};

export type ServiceOccurrence = {
  service: ServiceType;
  startsAt: Date;
  endsAt: Date;
  /** Le culte a commencé et n'est pas terminé. */
  inProgress: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function atMinutes(day: Date, minutes: number): Date {
  return new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()) + minutes * 60 * 1000,
  );
}

/** Prochaine occurrence d'un culte, ou l'occurrence en cours. */
export function nextOccurrenceOf(service: ServiceType, now: Date): ServiceOccurrence {
  const start = minutesOf(service.start_time);
  const end = minutesOf(service.end_time);
  const daysAhead = (service.weekday - now.getUTCDay() + 7) % 7;

  // On regarde ce jour-là, et la semaine suivante si l'occurrence est passée.
  for (const extra of [0, 7]) {
    const day = new Date(now.getTime() + (daysAhead + extra) * DAY_MS);
    const startsAt = atMinutes(day, start);
    const endsAt = atMinutes(day, end);
    if (endsAt > now) {
      return { service, startsAt, endsAt, inProgress: startsAt <= now };
    }
  }
  throw new Error("Occurrence introuvable");
}

/** Le culte en cours s'il y en a un, sinon le plus proche à venir. */
export function nextService(services: ServiceType[], now: Date): ServiceOccurrence | null {
  const occurrences = services.map((s) => nextOccurrenceOf(s, now));
  if (occurrences.length === 0) return null;
  return occurrences.sort((a, b) => {
    if (a.inProgress !== b.inProgress) return a.inProgress ? -1 : 1;
    return a.startsAt.getTime() - b.startsAt.getTime();
  })[0];
}

/** Toutes les occurrences des 7 prochains jours, dans l'ordre chronologique. */
export function weekProgramme(services: ServiceType[], now: Date): ServiceOccurrence[] {
  return services
    .map((s) => nextOccurrenceOf(s, now))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** Temps restant découpé pour le compte à rebours. */
export function countdownParts(target: Date, now: Date) {
  const total = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/** « 09:00:00 » → « 9 h », « 18:30 » → « 18 h 30 » */
export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}
