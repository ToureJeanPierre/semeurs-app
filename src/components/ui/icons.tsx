import { createElement } from "react";
import {
  BookOpen,
  CalendarDays,
  HandHeart,
  HeartHandshake,
  Megaphone,
  Sparkles,
  UsersRound,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

/**
 * Icônes proposées pour les modules et raccourcis. La base stocke le nom
 * (kebab-case, comme sur lucide.dev) ; un nom inconnu affiche une étincelle.
 * Pour proposer une nouvelle icône à l'administrateur, l'ajouter ici.
 */
const ICONS: Record<string, LucideIcon> = {
  "book-open": BookOpen,
  "calendar-days": CalendarDays,
  "hand-heart": HandHeart,
  "heart-handshake": HeartHandshake,
  megaphone: Megaphone,
  sparkles: Sparkles,
  "users-round": UsersRound,
};

export function ModuleIcon({ name, ...props }: LucideProps & { name: string }) {
  return createElement(ICONS[name] ?? Sparkles, { "aria-hidden": true, ...props });
}
