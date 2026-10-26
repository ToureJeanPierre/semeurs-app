"use client";

import { motion } from "framer-motion";

/** Verset du jour, dans une carte blanche sobre (maquette du 26/10/2026). */
export function VerseCard({ reference, text }: { reference: string; text: string }) {
  return (
    <motion.figure
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.55, duration: 0.45 }}
      className="relative overflow-hidden rounded-card border-l-4 border-gold bg-surface p-4 shadow-card"
    >
      <figcaption className="font-display font-semibold text-ink">Verset du jour</figcaption>
      <blockquote className="mt-2 text-[0.9375rem] leading-relaxed text-ink">« {text} »</blockquote>
      <p className="mt-2 text-sm font-semibold text-royal">
        <cite className="not-italic">{reference}</cite>
      </p>
    </motion.figure>
  );
}
