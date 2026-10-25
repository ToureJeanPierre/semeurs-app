"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CircleCheck, CircleAlert } from "lucide-react";
import { useEffect } from "react";

export type ToastMessage = { tone: "success" | "error"; text: string } | null;

/** Message bref en bas de l'écran ; disparaît seul au bout de 4 s. */
export function Toast({ message, onDone }: { message: ToastMessage; onDone: () => void }) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDone, 4000);
    return () => clearTimeout(timer);
  }, [message, onDone]);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center px-4">
      <AnimatePresence>
        {message && (
          <motion.div
            role="status"
            initial={reduceMotion ? false : { y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className={`flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold shadow-float ${
              message.tone === "success" ? "bg-ok-bg text-ok-text" : "bg-alert-bg text-alert-text"
            }`}
          >
            {message.tone === "success" ? (
              <CircleCheck aria-hidden className="size-5 shrink-0" />
            ) : (
              <CircleAlert aria-hidden className="size-5 shrink-0" />
            )}
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
