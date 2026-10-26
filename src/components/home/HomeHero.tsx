"use client";

import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { HeroSky } from "@/components/ui/HeroSky";

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

export function HomeHero({
  greeting,
  churchName,
  tagline,
}: {
  greeting: string;
  churchName: string;
  tagline?: string;
}) {
  return (
    <HeroSky className="px-5 pb-20 pt-6">
      <motion.div
        className="mx-auto max-w-lg"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.09 } } }}
      >
        <motion.div variants={item} className="flex items-center gap-3">
          <span className="relative grid size-14 shrink-0 place-items-center">
            <span
              aria-hidden
              className="absolute inset-0 animate-halo rounded-full"
              style={{
                background:
                  "conic-gradient(from 0deg, var(--color-gold), transparent 30%, var(--color-sky) 55%, transparent 80%, var(--color-gold))",
              }}
            />
            <span className="relative rounded-full bg-white p-0.5">
              <Logo size={50} priority />
            </span>
          </span>
          <p className="text-sm font-semibold leading-tight text-white/90">{churchName}</p>
        </motion.div>

        <motion.p variants={item} className="mt-7 text-white/85">
          {greeting}
        </motion.p>
        <motion.h1 variants={item} className="text-[1.875rem] font-extrabold">
          Bienvenue aux Semeurs
        </motion.h1>

        {tagline && (
          <motion.div variants={item} className="mt-3 max-w-xs">
            <p className="font-display text-lg font-semibold italic leading-snug text-white">
              {tagline}
            </p>
            <svg aria-hidden viewBox="0 0 200 12" className="mt-1 h-3 w-40 text-gold">
              <motion.path
                d="M2 9 C 50 2, 120 2, 198 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.6, duration: 0.9, ease: "easeInOut" }}
              />
            </svg>
          </motion.div>
        )}
      </motion.div>
    </HeroSky>
  );
}
