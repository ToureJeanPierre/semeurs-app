"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

const VARIANTS = {
  rise: { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 } },
  pop: { initial: { opacity: 0, scale: 0.6 }, animate: { opacity: 1, scale: 1 } },
};

/** Apparition à l'ouverture de la page (montée douce ou « pop » avec ressort). */
export function Reveal({
  children,
  delay = 0,
  variant = "rise",
  className,
}: {
  children: ReactNode;
  delay?: number;
  variant?: keyof typeof VARIANTS;
  className?: string;
}) {
  const v = VARIANTS[variant];
  return (
    <motion.div
      className={className}
      initial={v.initial}
      animate={v.animate}
      transition={
        variant === "pop"
          ? { delay, type: "spring", stiffness: 260, damping: 18 }
          : { delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }
      }
    >
      {children}
    </motion.div>
  );
}
