"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import { ModuleIcon } from "@/components/ui/icons";
import type { HomeModule } from "@/lib/home";

const tile = {
  hidden: { opacity: 0, y: 18, scale: 0.92 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 320, damping: 24 } },
};

function TileContent({ module }: { module: HomeModule }) {
  return (
    <>
      <span className="relative grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-royal to-night text-white shadow-float">
        <ModuleIcon name={module.icon} className="size-7" strokeWidth={1.8} />
        {!module.enabled && (
          <span className="absolute -right-2 -top-2 rounded-full bg-gold px-1.5 py-0.5 text-[0.6875rem] font-bold leading-none text-night">
            Bientôt
          </span>
        )}
      </span>
      <span className="text-center text-sm font-semibold leading-tight text-ink">{module.label}</span>
    </>
  );
}

/** Raccourcis de l'accueil, issus de la table « modules » (activables par l'administrateur). */
export function ShortcutGrid({ modules }: { modules: HomeModule[] }) {
  const [toast, setToast] = useState<ToastMessage>(null);
  if (modules.length === 0) return null;

  const tileClass =
    "flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-card bg-surface px-2 py-3 shadow-card";

  return (
    <section aria-labelledby="shortcuts-title">
      <h2 id="shortcuts-title" className="sr-only">
        Raccourcis
      </h2>
      <motion.ul
        className="grid grid-cols-3 gap-3"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { delayChildren: 0.35, staggerChildren: 0.06 } } }}
      >
        {modules.map((m) => (
          <motion.li key={m.code} variants={tile} whileTap={{ scale: 0.94 }} whileHover={{ y: -3 }}>
            {m.enabled && m.href ? (
              <Link href={m.href} className={tileClass}>
                <TileContent module={m} />
              </Link>
            ) : (
              <button
                type="button"
                className={tileClass}
                aria-label={`${m.label} : bientôt disponible`}
                onClick={() =>
                  setToast({
                    tone: "info",
                    text: m.description ? `« ${m.label} » arrive bientôt : ${m.description.toLowerCase()}.` : `« ${m.label} » arrive bientôt.`,
                  })
                }
              >
                <TileContent module={m} />
              </button>
            )}
          </motion.li>
        ))}
      </motion.ul>
      <Toast message={toast} onDone={() => setToast(null)} />
    </section>
  );
}
