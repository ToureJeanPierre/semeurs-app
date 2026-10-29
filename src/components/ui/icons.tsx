import { createElement, type ComponentType } from "react";
import {
  BookOpen,
  BellRing,
  Baby,
  CalendarCheck,
  ClipboardList,
  Footprints,
  GraduationCap,
  Package,
  ScrollText,
  Vote,
  LayoutDashboard,
  Sprout,
  Video,
  Wallet,
  CalendarClock,
  CalendarDays,
  SquareCheck,
  CirclePlay,
  HandHeart,
  Heart,
  HeartHandshake,
  House,
  Megaphone,
  Network,
  Settings,
  Sparkles,
  UserRound,
  UsersRound,
  type LucideProps,
} from "lucide-react";

/** Mains jointes en prière (absent de Lucide), dessiné dans le même style de trait. */
function HandsPraying({ size = 24, strokeWidth = 2, color = "currentColor", ...props }: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 16V5.2c0-1.3-1.6-1.9-2.4-.8L9 5.5 7.4 12.2 4.6 15.3" />
      <path d="M12 16V5.2c0-1.3 1.6-1.9 2.4-.8l.6 1.1 1.6 6.7 2.8 3.1" />
      <path d="M12 16l-5 5-4.5-4.4 2.1-2.3" />
      <path d="M12 16l5 5 4.5-4.4-2.1-2.3" />
      <path d="M9.6 8.5l1.4 2" />
      <path d="M14.4 8.5l-1.4 2" />
    </svg>
  );
}

/**
 * Icônes proposées pour les modules et la navigation. La base stocke le nom
 * (kebab-case, comme sur lucide.dev) ; un nom inconnu affiche une étincelle.
 * Pour proposer une nouvelle icône à l'administrateur, l'ajouter ici.
 */
const ICONS: Record<string, ComponentType<LucideProps>> = {
  baby: Baby,
  "book-open": BookOpen,
  "calendar-check": CalendarCheck,
  "clipboard-list": ClipboardList,
  footprints: Footprints,
  "graduation-cap": GraduationCap,
  package: Package,
  "scroll-text": ScrollText,
  vote: Vote,
  "layout-dashboard": LayoutDashboard,
  sprout: Sprout,
  video: Video,
  wallet: Wallet,
  "bell-ring": BellRing,
  "calendar-clock": CalendarClock,
  "calendar-days": CalendarDays,
  "check-square": SquareCheck,
  "circle-play": CirclePlay,
  "hand-heart": HandHeart,
  "hands-praying": HandsPraying,
  heart: Heart,
  "heart-handshake": HeartHandshake,
  house: House,
  megaphone: Megaphone,
  network: Network,
  settings: Settings,
  sparkles: Sparkles,
  "user-round": UserRound,
  "users-round": UsersRound,
};

/** Mains jointes, utilisable directement (bouton « Je prie »). */
export function HandsPrayingIcon(props: LucideProps) {
  return createElement(HandsPraying, { "aria-hidden": true, ...props });
}

export function ModuleIcon({ name, ...props }: LucideProps & { name: string }) {
  return createElement(ICONS[name] ?? Sparkles, { "aria-hidden": true, ...props });
}
