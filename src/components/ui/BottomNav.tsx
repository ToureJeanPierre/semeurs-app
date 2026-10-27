"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ModuleIcon } from "@/components/ui/icons";
import { markTabNavigation } from "@/components/layout/NavTrail";
import type { NavLink } from "@/lib/navigation";

/** Barre du bas : icônes alignées, l'onglet actif en bleu roi (maquette du 26/10/2026). */
export function BottomNav({ items }: { items: NavLink[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_-8px_rgb(11_42_111/0.15)]"
    >
      <ul className="mx-auto flex max-w-lg">
        {items.map(({ href, label, icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                // Onglets préchargés en entier : ils s'ouvrent sans attendre le serveur.
                prefetch
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  if (!active) markTabNavigation();
                }}
                className={`relative flex min-h-16 flex-col items-center justify-center gap-1 text-xs transition-colors ${
                  active ? "font-bold text-royal" : "font-medium text-muted"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-indicator"
                    aria-hidden
                    className="absolute top-0 h-[3px] w-8 rounded-b-full bg-royal"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}
                <motion.span whileTap={{ scale: 0.82 }} animate={{ scale: active ? 1.08 : 1 }}>
                  <ModuleIcon name={icon} className="size-6" strokeWidth={active ? 2.3 : 1.8} />
                </motion.span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
