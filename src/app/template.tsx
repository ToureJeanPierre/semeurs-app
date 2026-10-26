"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/** Transition douce à chaque changement de page. */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
