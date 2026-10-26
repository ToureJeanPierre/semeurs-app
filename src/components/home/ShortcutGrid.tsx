"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ModuleIcon } from "@/components/ui/icons";

export type Shortcut = { code: string; label: string; icon: string; href: string };

const tile = {
  hidden: { opacity: 0, y: 14, scale: 0.9 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 340, damping: 24 } },
};

/** Grille des raccourcis (table « modules ») : carré bleu, libellé dessous. */
export function ShortcutGrid({ items }: { items: Shortcut[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Raccourcis">
      <motion.ul
        className="grid grid-cols-3 gap-x-3 gap-y-5"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { delayChildren: 0.3, staggerChildren: 0.06 } } }}
      >
        {items.map((m) => (
          <motion.li key={m.code} variants={tile}>
            <Link href={m.href} className="group flex flex-col items-center gap-2">
              <motion.span
                whileTap={{ scale: 0.9 }}
                className="grid size-16 place-items-center rounded-2xl bg-gradient-to-b from-royal to-night text-white shadow-float transition-transform group-hover:-translate-y-0.5"
              >
                <ModuleIcon name={m.icon} className="size-8" strokeWidth={1.8} />
              </motion.span>
              <span className="text-center text-sm font-semibold leading-tight text-ink">{m.label}</span>
            </Link>
          </motion.li>
        ))}
      </motion.ul>
    </nav>
  );
}
