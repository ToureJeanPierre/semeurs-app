"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, EllipsisVertical } from "lucide-react";
import { Logo } from "@/components/Logo";
import type { menuLinks } from "@/lib/navigation";
import { MenuSheet } from "./MenuSheet";

const iconButton =
  "grid size-11 place-items-center rounded-full text-white transition-colors hover:bg-white/10 active:bg-white/20";

/**
 * Barre du haut, bleu roi (maquette du 26/10/2026).
 * - Accueil : logo et nom de l'église.
 * - Autres pages : flèche retour et titre.
 * À droite : cloche (annonces) et trois points qui ouvrent le menu complet.
 */
export function AppHeader({
  title,
  menu,
  bellHref,
}: {
  title?: string;
  menu: ReturnType<typeof menuLinks>;
  bellHref: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 bg-royal pt-[env(safe-area-inset-top)] text-white">
        <div className="mx-auto flex h-16 max-w-lg items-center gap-2 px-2">
          {title ? (
            <>
              <button type="button" onClick={() => router.back()} className={iconButton} aria-label="Retour">
                <ArrowLeft aria-hidden className="size-6" />
              </button>
              <h1 className="min-w-0 flex-1 truncate font-display text-xl font-semibold">{title}</h1>
            </>
          ) : (
            <Link href="/" className="flex min-w-0 flex-1 items-center gap-3 pl-2" aria-label="Accueil">
              <span className="shrink-0 rounded-full bg-white p-0.5 shadow-float">
                <Logo size={40} priority />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block text-xs font-medium text-white/85">Église Évangélique</span>
                <span className="block truncate font-display text-base font-semibold">
                  Les Semeurs de la Parole
                </span>
              </span>
            </Link>
          )}
          <Link href={bellHref} className={iconButton} aria-label="Annonces">
            <Bell aria-hidden className="size-6" />
          </Link>
          <button
            type="button"
            className={iconButton}
            aria-label="Ouvrir le menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <EllipsisVertical aria-hidden className="size-6" />
          </button>
        </div>
      </header>
      <MenuSheet open={open} onClose={() => setOpen(false)} items={menu} />
    </>
  );
}
