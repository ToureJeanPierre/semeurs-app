"use client";

import { motion } from "framer-motion";

/**
 * Baromètre de la famille (docs/03 §2) : barre segmentée rouge / orange / vert,
 * proportionnelle au nombre de fidèles dans chaque état, qui se remplit de gauche à droite.
 */
export function Barometer({ red, orange, green }: { red: number; orange: number; green: number }) {
  const total = red + orange + green || 1;
  const parts = [
    { n: red, color: "var(--color-alert-ring)", label: "à contacter d'urgence" },
    { n: orange, color: "var(--color-warn-ring)", label: "à surveiller" },
    { n: green, color: "var(--color-ok-ring)", label: "à jour" },
  ];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-4 overflow-hidden rounded-full bg-line" aria-hidden>
        {parts.map((p, i) =>
          p.n ? (
            <motion.span
              key={i}
              className="h-full"
              style={{ background: p.color }}
              initial={{ width: 0 }}
              animate={{ width: `${(p.n / total) * 100}%` }}
              transition={{ duration: 0.9, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
            />
          ) : null,
        )}
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {parts.map((p) => (
          <div key={p.label}>
            <dt className="text-xs text-muted">{p.label}</dt>
            <dd className="font-display text-2xl font-extrabold" style={{ color: p.color }}>
              {p.n}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
