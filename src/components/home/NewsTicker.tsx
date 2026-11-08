"use client";

import Link from "next/link";
import { Megaphone } from "lucide-react";

export type TickerItem = { id: string; text: string; href: string };

/**
 * Bande déroulante des annonces (demande de Jean-Pierre du 08/11/2026), entre la bannière du verset
 * et les bannières animées : les messages de l'église et de mes groupes, puis les prochains événements.
 * Défile en continu ; s'arrête quand on la touche ; immobile (défilement à la main) si le téléphone
 * demande moins d'animations.
 */
export function NewsTicker({ items }: { items: TickerItem[] }) {
  if (items.length === 0) return null;
  // Vitesse constante : la durée suit la longueur du texte (≈ 9 caractères par seconde).
  const seconds = Math.max(18, Math.round(items.reduce((n, i) => n + i.text.length + 6, 0) / 9));
  const row = (copy: number) => (
    <ul className="flex shrink-0 items-center" aria-hidden={copy > 0 || undefined}>
      {items.map((item) => (
        <li key={`${copy}-${item.id}`} className="flex items-center">
          <Link href={item.href} tabIndex={copy > 0 ? -1 : 0} className="flex min-h-11 items-center whitespace-nowrap px-1 text-sm font-semibold text-white">
            {item.text}
          </Link>
          <span aria-hidden className="mx-3 text-gold">
            ✦
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <section aria-label="Annonces de l'église" className="relative flex h-11 items-stretch overflow-hidden bg-gradient-to-r from-night via-royal to-night shadow-[0_6px_14px_-8px_rgba(11,42,111,.6)]">
      <Link
        href="/messages"
        className="relative z-10 flex shrink-0 items-center gap-1.5 bg-gold px-3 font-display text-xs font-extrabold uppercase tracking-wide text-night shadow-[6px_0_12px_-4px_rgba(0,0,0,.35)]"
      >
        <Megaphone aria-hidden className="size-4 motion-safe:animate-[ticker-shake_2.4s_ease-in-out_infinite]" />
        Annonces
      </Link>
      <div className="ticker-mask relative min-w-0 flex-1 overflow-x-auto motion-safe:overflow-hidden [scrollbar-width:none]">
        <div
          className="flex w-max motion-safe:animate-[ticker-scroll_var(--ticker-duration)_linear_infinite] hover:[animation-play-state:paused] active:[animation-play-state:paused]"
          style={{ ["--ticker-duration" as string]: `${seconds}s` }}
        >
          {row(0)}
          {row(1)}
        </div>
      </div>
    </section>
  );
}
