"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { House, UserRound, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

/** Lot 0 : entrées minimales. Au lot 1, elles dépendront du rôle (docs/03 §4). */
const DEFAULT_ITEMS: NavItem[] = [
  { href: "/", label: "Accueil", icon: House },
  { href: "/profil", label: "Profil", icon: UserRound },
];

export function BottomNav({ items = DEFAULT_ITEMS }: { items?: NavItem[] }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-lg">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold ${
                  active ? "text-royal" : "text-muted"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-indicator"
                    className="absolute top-0 h-1 w-10 rounded-full bg-royal"
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.25 }}
                  />
                )}
                <Icon aria-hidden className="size-6" strokeWidth={1.9} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
