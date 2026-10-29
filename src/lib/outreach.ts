import { formatTime, nextService, type ServiceType } from "@/lib/services";

/** Repli si le modèle « outreach_invite » n'a pas encore été écrit dans les paramètres. */
export const INVITE_FALLBACK =
  "Bonjour {prénom}, que la paix de Dieu soit avec vous ! Nous serons heureux de vous accueillir {culte} à l'église Les Semeurs de la Parole. Que Dieu vous bénisse !";

const dayLabel = new Intl.DateTimeFormat("fr-CI", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Abidjan" });

/**
 * Le prochain culte, dit comme dans une invitation :
 * « au culte d'actions de grâces de ce dimanche 2 novembre à 9 h ».
 */
export function nextServicePhrase(services: ServiceType[], now: Date): { phrase: string; label: string } | null {
  const next = nextService(services, now);
  if (!next) return null;
  const name = next.service.name.charAt(0).toLowerCase() + next.service.name.slice(1);
  const day = dayLabel.format(next.startsAt);
  const when = `${day} à ${formatTime(next.service.start_time)}`;
  return { phrase: `au ${name} de ce ${when}`, label: `${next.service.name} · ${day.charAt(0).toUpperCase()}${day.slice(1)} à ${formatTime(next.service.start_time)}` };
}

/** Message d'invitation : {prénom} et {culte} remplacés. */
export function inviteMessage(template: string, firstName: string, culte: string): string {
  return template.replaceAll("{prénom}", firstName).replaceAll("{prenom}", firstName).replaceAll("{culte}", culte);
}
