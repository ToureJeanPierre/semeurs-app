"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Bell, Menu } from "lucide-react";
import { Logo } from "@/components/Logo";
import type { menuLinks } from "@/lib/navigation";
import { MenuSheet } from "./MenuSheet";

const iconButton =
  "grid size-11 place-items-center rounded-full text-white transition-colors hover:bg-white/10 active:bg-white/20";

/**
 * Barre du haut, bleu roi (maquette du 26/10/2026).
 * - Accueil : trois traits (menu complet) à gauche, logo et nom de l'église.
 * - Autres pages : flèche retour et titre (celui de l'entrée du menu), trois traits à droite.
 * Cloche (annonces) à droite. La barre reste affichée d'une page à l'autre.
 */
export function AppHeader({ menu, bellHref }: { menu: ReturnType<typeof menuLinks>; bellHref: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const title = pathname === "/" ? undefined : (menu.find((m) => m.href === pathname)?.label ?? "");
  const [open, setOpen] = useState(false);

  const menuButton = (
    <button
      type="button"
      className={iconButton}
      aria-label="Ouvrir le menu"
      aria-expanded={open}
      onClick={() => setOpen(true)}
    >
      <Menu aria-hidden className="size-7" />
    </button>
  );

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
            <>
              {menuButton}
              <Link href="/" className="flex min-w-0 flex-1 items-center gap-2.5" aria-label="Accueil">
                <span className="shrink-0">
                  <Logo size={44} priority />
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block text-xs font-medium text-white/85">Église Évangélique</span>
                  <span className="block truncate font-display text-base font-semibold">
                    Les Semeurs de la Parole
                  </span>
                </span>
              </Link>
            </>
          )}
          <Link href={bellHref} className={iconButton} aria-label="Annonces">
            <Bell aria-hidden className="size-6" />
          </Link>
          {title && menuButton}
        </div>
      </header>
      <MenuSheet open={open} onClose={() => setOpen(false)} items={menu} side={title ? "right" : "left"} />
    </>
  );
}
