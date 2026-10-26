"use client";

import { motion } from "framer-motion";
import { BookOpenText } from "lucide-react";

/** Verset du jour : les mots apparaissent l'un après l'autre. */
export function VerseCard({ reference, text, translation }: { reference: string; text: string; translation: string }) {
  const words = text.split(" ");
  return (
    <motion.figure
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-card bg-gradient-to-br from-night via-royal to-royal p-6 text-white shadow-card"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute right-4 top-1 font-serif text-[7rem] leading-none text-gold/30"
      >
        &ldquo;
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -left-10 size-44 animate-glow rounded-full bg-sky/30 blur-2xl"
      />
      <figcaption className="relative flex items-center gap-2 text-sm font-semibold text-gold">
        <BookOpenText aria-hidden className="size-5" />
        Verset du jour
      </figcaption>
      <motion.blockquote
        className="relative mt-3 font-display text-xl font-semibold leading-snug"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.4 }}
        variants={{ show: { transition: { staggerChildren: 0.035, delayChildren: 0.15 } } }}
        aria-label={text}
      >
        {words.map((w, i) => (
          <motion.span
            key={i}
            aria-hidden
            className="inline-block"
            variants={{ hidden: { opacity: 0, y: 8, filter: "blur(4px)" }, show: { opacity: 1, y: 0, filter: "blur(0px)" } }}
          >
            {w}&nbsp;
          </motion.span>
        ))}
      </motion.blockquote>
      <p className="relative mt-4 text-sm text-white/85">
        <cite className="not-italic font-semibold text-white">{reference}</cite> · {translation}
      </p>
    </motion.figure>
  );
}
