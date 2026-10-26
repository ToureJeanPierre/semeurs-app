"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { House, UserRound, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

/** Lot 0 : entrées minimales. Au lot 1, elles dépendront du rôle (docs/03 §4). */
const DEFAULT_ITEMS: NavItem[] = [
  { href: "/", label: "Accueil", icon: House },
  { href: "/profil", label: "Profil", icon: UserRound },
];

export function BottomNav({ items = DEFAULT_ITEMS }: { items?: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <ul className="mx-auto flex max-w-lg rounded-[1.75rem] border border-line/70 bg-surface/90 p-1.5 shadow-float backdrop-blur-md">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[1.375rem] text-xs font-semibold transition-colors ${
                  active ? "text-white" : "text-muted"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-indicator"
                    aria-hidden
                    className="absolute inset-0 rounded-[1.375rem] bg-gradient-to-br from-royal to-night"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <motion.span
                  className="relative"
                  whileTap={{ scale: 0.85 }}
                  animate={active ? { y: [0, -3, 0] } : { y: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  <Icon aria-hidden className="size-6" strokeWidth={1.9} />
                </motion.span>
                <span className="relative">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
