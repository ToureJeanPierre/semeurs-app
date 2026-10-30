"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Bell, Menu } from "lucide-react";
import { Logo } from "@/components/Logo";
import type { menuLinks } from "@/lib/navigation";
import { MenuSheet } from "./MenuSheet";
import { OPEN_MENU_EVENT, useNavTrail } from "./NavTrail";

const FALLBACK_TITLES: Record<string, string> = {
  "/notifications": "Notifications",
  "/fideles": "Fidèles",
  "/famille": "Ma famille",
  "/mon-espace": "Mon espace",
  "/profil": "Profil",
  "/formations": "Formations",
  "/sondages": "Sondages",
  "/actes": "Registre des actes",
  "/inventaire": "Inventaire",
  "/evenements": "Événements",
  "/predications": "Prédications",
  "/evangelisation": "Évangélisation",
  "/bilans": "Bilans",
};

const iconButton =
  "grid size-11 place-items-center rounded-full transition-colors hover:bg-current/10 active:bg-current/20";

/**
 * Barre du haut, bleu roi (maquette du 26/10/2026).
 * - Accueil : trois traits (menu complet) à gauche, logo et nom de l'église.
 * - Autres pages : flèche retour (refait le chemin parcouru, jamais hors de l'appli) et titre (celui de l'entrée du menu), trois traits à droite.
 * Cloche (notifications, avec le nombre de non lues) à droite. La barre reste affichée d'une page à l'autre.
 */
export function AppHeader({ menu, unread }: { menu: ReturnType<typeof menuLinks>; unread: number }) {
  const pathname = usePathname();
  const { back } = useNavTrail();

  // Titre : l'entrée du menu dont l'adresse est le début le plus long de la page courante,
  // sinon le titre par défaut de la rubrique (écran absent du menu de cette personne).
  const title =
    pathname === "/"
      ? undefined
      : pathname.endsWith("/discussion")
        ? "Discussion"
        : (menu
          .filter((m) => m.href !== "/" && (pathname === m.href || pathname.startsWith(`${m.href}/`)))
          .sort((a, b) => b.href.length - a.href.length)[0]?.label ??
        FALLBACK_TITLES[`/${pathname.split("/")[1]}`] ??
        "");
  const [open, setOpen] = useState(false);

  // Retour vers un écran d'où l'on avait ouvert le menu : on le rouvre (comme Yango).
  useEffect(() => {
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_MENU_EVENT, reopen);
    return () => window.removeEventListener(OPEN_MENU_EVENT, reopen);
  }, []);

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
      {/* Accueil : barre bleu roi avec le logo. Onglets : barre claire et translucide (maquette du 29/10). */}
      <header
        className={`sticky top-0 z-30 pt-[env(safe-area-inset-top)] ${
          title ? "border-b border-line/60 bg-white/85 text-royal backdrop-blur-md" : "bg-royal text-white"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-lg items-center gap-2 px-2">
          {title ? (
            <>
              <button type="button" onClick={back} className={iconButton} aria-label="Retour">
                <ArrowLeft aria-hidden className="size-6" />
              </button>
              <p className="min-w-0 flex-1 truncate font-display text-xl font-bold text-night">{title}</p>
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
          <Link
            href="/notifications"
            className={`relative ${iconButton}`}
            aria-label={unread ? `Notifications : ${unread} non lue${unread > 1 ? "s" : ""}` : "Notifications"}
          >
            <Bell aria-hidden className="size-6" />
            {unread > 0 && (
              <span
                aria-hidden
                className={`absolute right-1.5 top-1.5 grid min-w-5 place-items-center rounded-full bg-alert-ring px-1 text-[0.6875rem] font-bold leading-5 text-white ring-2 ${title ? "ring-white" : "ring-royal"}`}
              >
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          {title && menuButton}
        </div>
      </header>
      <MenuSheet open={open} onClose={() => setOpen(false)} items={menu} side={title ? "right" : "left"} />
    </>
  );
}
