import { createElement } from "react";
import {
  BookOpen,
  CalendarDays,
  CirclePlay,
  HandHeart,
  Heart,
  HeartHandshake,
  House,
  Megaphone,
  Sparkles,
  UserRound,
  UsersRound,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

/**
 * Icônes proposées pour les modules et la navigation. La base stocke le nom
 * (kebab-case, comme sur lucide.dev) ; un nom inconnu affiche une étincelle.
 * Pour proposer une nouvelle icône à l'administrateur, l'ajouter ici.
 */
const ICONS: Record<string, LucideIcon> = {
  "book-open": BookOpen,
  "calendar-days": CalendarDays,
  "circle-play": CirclePlay,
  "hand-heart": HandHeart,
  heart: Heart,
  "heart-handshake": HeartHandshake,
  house: House,
  megaphone: Megaphone,
  sparkles: Sparkles,
  "user-round": UserRound,
  "users-round": UsersRound,
};

export function ModuleIcon({ name, ...props }: LucideProps & { name: string }) {
  return createElement(ICONS[name] ?? Sparkles, { "aria-hidden": true, ...props });
}
