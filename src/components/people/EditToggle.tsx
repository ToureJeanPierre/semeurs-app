"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pencil, X } from "lucide-react";

/** Le formulaire de modification ne s'ouvre qu'à la demande : la fiche reste lisible. */
export function EditToggle({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-royal/20 bg-surface px-6 font-semibold text-royal"
      >
        {open ? <X aria-hidden className="size-5" /> : <Pencil aria-hidden className="size-5" />}
        {open ? "Fermer sans modifier" : label}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
