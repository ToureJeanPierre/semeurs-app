"use client";

import { motion } from "framer-motion";

export type ProgrammeItem = { id: string; day: string; date: string; name: string; hours: string; isNext: boolean };

/** Programme des 7 prochains jours, tiré des types de culte paramétrés. */
export function WeekProgramme({ items }: { items: ProgrammeItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="week-title">
      <h2 id="week-title" className="mb-3 text-xl font-semibold">
        Cette semaine
      </h2>
      <ol className="flex flex-col gap-2">
        {items.map((it, i) => (
          <motion.li
            key={it.id}
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.07, duration: 0.35 }}
            className="flex items-center gap-4 rounded-card bg-surface p-3 pr-4 shadow-card"
          >
            <span
              className={`flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl ${
                it.isNext ? "bg-gold text-night" : "bg-royal/10 text-royal"
              }`}
            >
              <span className="text-xs font-semibold">{it.day}</span>
              <span className="font-display text-xl font-extrabold leading-none">{it.date}</span>
            </span>
            <div className="min-w-0">
              <p className="font-semibold leading-snug">{it.name}</p>
              <p className="text-sm text-muted">{it.hours}</p>
            </div>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
