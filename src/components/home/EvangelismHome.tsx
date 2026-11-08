"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { HeartHandshake, Phone, Sprout } from "lucide-react";

const PHRASES = [
  "Vous avez parlé de Jésus-Christ à quelqu'un ?",
  "Notez son nom, son numéro, son quartier.",
  "Appelez-le, invitez-le au prochain culte.",
  "Une âme gagnée, toute l'église se réjouit !",
];

/**
 * Accueil : l'évangélisation, l'affaire de tous (demande de Jean-Pierre du 08/11/2026).
 * Phrases qui se succèdent, pousse qui grandit, fond qui ondule ; boutons vers l'onglet.
 */
export function EvangelismHome({ toInvite }: { toInvite: number }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setI((n) => (n + 1) % PHRASES.length), 3200);
    return () => clearInterval(timer);
  }, []);

  return (
    <section
      aria-label="Évangélisation"
      className="relative overflow-hidden rounded-[1.5rem] bg-[linear-gradient(120deg,#0f8a57,#1fb877,#13a3a3,#0f8a57)] bg-[length:300%_300%] p-4 text-white shadow-float motion-safe:animate-[evangelism-wave_12s_ease-in-out_infinite]"
    >
      {/* Graines lumineuses qui montent. */}
      {!reduce &&
        [12, 38, 64, 86].map((left, k) => (
          <motion.span
            key={left}
            aria-hidden
            className="absolute bottom-0 size-2 rounded-full bg-white/60"
            style={{ left: `${left}%` }}
            animate={{ y: [0, -160], opacity: [0, 1, 0] }}
            transition={{ duration: 4 + k, repeat: Infinity, delay: k * 0.9, ease: "easeOut" }}
          />
        ))}

      <div className="relative flex items-start gap-3">
        <motion.span
          className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/20 backdrop-blur"
          animate={reduce ? undefined : { scale: [1, 1.12, 1], rotate: [0, -6, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <Sprout aria-hidden className="size-8" />
        </motion.span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold uppercase tracking-wide text-white/80">Évangélisation</p>
          <h2 className="font-display text-xl font-extrabold leading-tight text-white">Semons la Parole ensemble</h2>
          <div className="mt-1 h-11" aria-live="polite">
            <AnimatePresence mode="wait">
              <motion.p
                key={i}
                className="text-[0.9375rem] leading-snug text-white/95"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
                transition={{ duration: 0.35 }}
              >
                {PHRASES[i]}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="relative mt-3 grid grid-cols-2 gap-2">
        <Link
          href="/evangelisation"
          className="flex min-h-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-white px-2 text-sm font-bold text-[#0f7a4c] shadow-card active:scale-95"
        >
          <HeartHandshake aria-hidden className="size-5 shrink-0" /> Noter quelqu&apos;un
        </Link>
        <Link
          href="/evangelisation"
          className="relative flex min-h-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-white/20 px-2 text-sm font-bold backdrop-blur active:scale-95"
        >
          <Phone aria-hidden className="size-5" />
          {toInvite > 0 ? `${toInvite} à inviter` : "Mes contacts"}
          {toInvite > 0 && !reduce && (
            <motion.span
              aria-hidden
              className="absolute -right-1 -top-1 size-3 rounded-full bg-gold"
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0.6, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            />
          )}
        </Link>
      </div>
    </section>
  );
}
