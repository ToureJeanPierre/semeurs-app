"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, MapPin } from "lucide-react";
import { countdownParts } from "@/lib/services";

/** Un chiffre qui glisse vers le haut quand il change. */
function Digit({ value, label }: { value: number; label: string }) {
  const text = String(value).padStart(2, "0");
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-11 w-12 overflow-hidden rounded-xl bg-night/95 text-white shadow-inner">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={text}
            className="absolute inset-0 grid place-items-center font-display text-2xl font-extrabold tabular-nums"
            initial={{ y: "-100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
          >
            {text}
          </motion.span>
        </AnimatePresence>
      </div>
      <span className="mt-1 text-xs font-medium text-muted">{label}</span>
    </div>
  );
}

export function NextServiceCard({
  name,
  when,
  place,
  startsAt,
  endsAt,
  serverNow,
}: {
  name: string;
  when: string;
  place: string | null;
  startsAt: string;
  endsAt: string;
  serverNow: string;
}) {
  const [now, setNow] = useState(() => new Date(serverNow));

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const start = new Date(startsAt);
  const inProgress = now >= start && now < new Date(endsAt);
  const { days, hours, minutes, seconds } = countdownParts(start, now);

  return (
    <motion.section
      aria-labelledby="next-service-title"
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.25, type: "spring", stiffness: 260, damping: 26 }}
      className="relative overflow-hidden rounded-card bg-surface p-5 shadow-card"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-shine bg-gradient-to-r from-transparent via-sky/10 to-transparent"
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-royal">Prochain culte</p>
          <h2 id="next-service-title" className="mt-0.5 text-xl font-semibold">
            {name}
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            <CalendarDays aria-hidden className="size-4 shrink-0" />
            {when}
          </p>
          {place && (
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
              <MapPin aria-hidden className="size-4 shrink-0" />
              <span className="truncate">{place}</span>
            </p>
          )}
        </div>
        {inProgress && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-alert-bg px-2.5 py-1 text-xs font-bold text-alert-text">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-alert-ring opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-alert-ring" />
            </span>
            En ce moment
          </span>
        )}
      </div>

      {inProgress ? (
        <p className="relative mt-4 rounded-2xl bg-royal/5 px-4 py-3 text-sm font-medium text-night">
          Le culte a commencé. Que Dieu vous bénisse pendant ce moment !
        </p>
      ) : (
        <div className="relative mt-4 flex items-start justify-between" role="timer" aria-live="off">
          <span className="sr-only">
            Début dans {days} jours, {hours} heures et {minutes} minutes
          </span>
          <div aria-hidden className="flex w-full justify-between">
            <Digit value={days} label={days > 1 ? "jours" : "jour"} />
            <Digit value={hours} label="heures" />
            <Digit value={minutes} label="min" />
            <Digit value={seconds} label="s" />
          </div>
        </div>
      )}
    </motion.section>
  );
}
