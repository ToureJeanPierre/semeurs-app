"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, Play } from "lucide-react";

function untilLabel(start: Date, now: Date) {
  const minutes = Math.max(0, Math.round((start.getTime() - now.getTime()) / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `dans ${days} j ${hours} h`;
  if (hours > 0) return `dans ${hours} h ${String(minutes % 60).padStart(2, "0")}`;
  return `dans ${minutes} min`;
}

/** Rappel discret du prochain culte (maquette du 26/10/2026). */
export function NextServiceCard({
  name,
  when,
  href,
  startsAt,
  endsAt,
  serverNow,
}: {
  name: string;
  when: string;
  href: string;
  startsAt: string;
  endsAt: string;
  serverNow: string;
}) {
  const [now, setNow] = useState(() => new Date(serverNow));

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const start = new Date(startsAt);
  const inProgress = now >= start && now < new Date(endsAt);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 32 }}
    >
      <Link
        href={href}
        className="flex items-center gap-3 rounded-card bg-surface p-3 pr-2 shadow-card active:scale-[0.99]"
      >
        <span className="relative grid size-12 shrink-0 place-items-center rounded-full bg-royal text-white">
          {inProgress && (
            <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-royal/40" />
          )}
          <Play aria-hidden className="relative ml-0.5 size-5 fill-current" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-muted">Prochain culte</span>
          <span className="block truncate font-display font-semibold text-ink">{name}</span>
          <span className="block text-sm text-muted">{when}</span>
        </span>
        {inProgress ? (
          <span className="shrink-0 rounded-full bg-alert-ring px-2 py-0.5 text-[0.6875rem] font-bold text-white">
            En cours
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-royal/10 px-2 py-0.5 text-xs font-semibold text-royal">
            {untilLabel(start, now)}
          </span>
        )}
        <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
      </Link>
    </motion.div>
  );
}
