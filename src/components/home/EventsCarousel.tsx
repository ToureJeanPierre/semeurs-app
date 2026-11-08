"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CalendarDays, ChevronRight, MapPin, Sparkles } from "lucide-react";

export type CarouselEvent = {
  id: string;
  title: string;
  kind: string;
  when: string;
  countdown: string;
  place: string | null;
  image: string;
  isPoster: boolean;
};

const DELAY = 5500;

/**
 * « À l'affiche » : les événements de l'église qui défilent sur l'accueil (demande de Jean-Pierre
 * du 08/11/2026). Affiche qui zoome doucement, titre qui apparaît mot à mot, compte à rebours,
 * glisser du doigt pour changer. Sans animation si le téléphone le demande (prefers-reduced-motion).
 */
export function EventsCarousel({ events }: { events: CarouselEvent[] }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = events.length;

  useEffect(() => {
    if (count < 2 || paused) return;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % count), DELAY);
    return () => clearTimeout(timer);
  }, [index, count, paused]);

  if (count === 0) return null;
  const e = events[index];
  const go = (step: number) => setIndex((i) => (i + step + count) % count);

  return (
    <section aria-label="Événements à l'affiche" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-night">
          <motion.span
            animate={reduce ? undefined : { rotate: [0, 18, -12, 0], scale: [1, 1.2, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.5 }}
            className="grid size-8 place-items-center rounded-lg bg-gold/25 text-[#a86b00]"
          >
            <Sparkles aria-hidden className="size-4" />
          </motion.span>
          À l&apos;affiche
        </h2>
        <Link href="/evenements" className="flex min-h-11 items-center gap-0.5 text-sm font-semibold text-royal">
          Tout voir <ChevronRight aria-hidden className="size-4" />
        </Link>
      </div>

      <div
        className="relative h-60 overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-royal via-[#1d5bd6] to-night shadow-float"
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={e.id}
            className="absolute inset-0"
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: -60 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            drag={count > 1 && !reduce ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.25}
            onDragEnd={(_, info) => {
              if (info.offset.x < -50) go(1);
              else if (info.offset.x > 50) go(-1);
            }}
          >
            {/* Image : l'affiche zoome lentement ; l'illustration flotte. */}
            <motion.div
              className={`absolute inset-0 ${e.isPoster ? "" : "flex items-center justify-end pr-2"}`}
              initial={{ scale: 1 }}
              animate={reduce ? undefined : e.isPoster ? { scale: 1.12 } : { y: [0, -8, 0] }}
              transition={e.isPoster ? { duration: 7, ease: "linear" } : { duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- affiche signée (stockage privé) */}
              <img
                src={e.image}
                alt=""
                className={e.isPoster ? "size-full object-cover" : "h-[85%] w-1/2 object-contain opacity-95 drop-shadow-xl"}
                draggable={false}
              />
            </motion.div>
            <div aria-hidden className={`absolute inset-0 ${e.isPoster ? "bg-gradient-to-t from-night via-night/55 to-transparent" : "bg-gradient-to-r from-night/80 via-night/30 to-transparent"}`} />

            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-4 text-white">
              <motion.div
                className="flex flex-wrap items-center gap-2"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <span className="rounded-full bg-gold px-2.5 py-0.5 text-xs font-bold text-night">{e.kind}</span>
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold backdrop-blur">{e.countdown}</span>
              </motion.div>
              <h3 className={`font-display text-2xl font-extrabold leading-tight drop-shadow ${e.isPoster ? "" : "max-w-[60%]"}`}>
                {e.title.split(" ").map((word, i) => (
                  <motion.span
                    key={`${e.id}-${i}`}
                    className="mr-[0.25em] inline-block"
                    initial={reduce ? false : { opacity: 0, y: 18, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{ delay: 0.25 + i * 0.08, duration: 0.4 }}
                  >
                    {word}
                  </motion.span>
                ))}
              </h3>
              <motion.p
                className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-white/90"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <span className="flex items-center gap-1">
                  <CalendarDays aria-hidden className="size-4" /> {e.when}
                </span>
                {e.place && (
                  <span className="flex items-center gap-1">
                    <MapPin aria-hidden className="size-4" /> {e.place}
                  </span>
                )}
              </motion.p>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Barre de progression : le temps avant l'événement suivant. */}
        {count > 1 && !reduce && !paused && (
          <motion.span
            key={`bar-${index}`}
            aria-hidden
            className="absolute left-0 top-0 h-1 bg-gold"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: DELAY / 1000, ease: "linear" }}
          />
        )}
      </div>

      {count > 1 && (
        <div className="flex justify-center gap-1.5" role="tablist" aria-label="Choisir un événement">
          {events.map((ev, i) => (
            <button
              key={ev.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={ev.title}
              onClick={() => setIndex(i)}
              className="grid h-11 min-w-6 place-items-center"
            >
              <span className={`block h-2 rounded-full transition-all ${i === index ? "w-6 bg-royal" : "w-2 bg-royal/25"}`} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
