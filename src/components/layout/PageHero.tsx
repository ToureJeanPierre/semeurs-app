"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCurrentArt } from "@/components/layout/PageArt";
import { ModuleIcon } from "@/components/ui/icons";

/**
 * Bandeau en tête d'onglet (maquette de Jean-Pierre) : illustration du module à droite,
 * accroche et verset sur l'écran principal de l'onglet, titre et détail sur les écrans intérieurs.
 * Tout vient de la table « modules » (illustration, accroche, verset) : rien n'est écrit ici.
 * `plain` garde un titre simple (fiche d'une personne, documents à imprimer).
 */
export function PageTitle({ title, intro, plain = false }: { title: string; intro?: ReactNode; plain?: boolean }) {
  const art = useCurrentArt();
  const pathname = usePathname();
  if (plain) {
    return (
      <div className="mb-4">
        <h1 className="font-display text-2xl font-extrabold text-night">{title}</h1>
        {intro && <p className="mt-1 text-muted">{intro}</p>}
      </div>
    );
  }
  // Titre identique à celui de la barre du haut : le bandeau donne l'accroche à la place.
  const same = !!art && title === art.label;
  const headline = same ? (art.heroTitle ?? title) : title;
  const eyebrow = same ? intro : art?.label;
  const detail = same ? null : intro;
  // Le verset n'apparaît que sur l'écran principal de l'onglet.
  const main = !!art && pathname === art.href;

  return (
    <section className="relative mb-4 overflow-hidden rounded-[1.375rem] bg-gradient-to-br from-[#f1f7ff] via-[#e4f0ff] to-[#cfe3fc] shadow-card print:hidden">
      {art?.image ? (
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 w-[46%]"
          style={{ maskImage: "linear-gradient(to right, transparent, black 38%)", WebkitMaskImage: "linear-gradient(to right, transparent, black 38%)" }}
        >
          <Image src={art.image} alt="" fill sizes="200px" unoptimized className="object-cover" priority />
        </div>
      ) : (
        <span aria-hidden className="absolute -right-6 -top-6 size-32 rounded-full bg-white/50" />
      )}
      <div className={`relative flex min-h-36 flex-col justify-center gap-1.5 p-4 ${art?.image ? "pr-[42%]" : ""}`}>
        {art && (
          <span className="mb-1 grid size-10 place-items-center rounded-xl bg-white/80 text-royal shadow-sm">
            <ModuleIcon name={art.icon} className="size-5" strokeWidth={1.9} />
          </span>
        )}
        {eyebrow && <p className="text-sm font-medium text-ink/70">{eyebrow}</p>}
        <h1 className="font-display text-[1.375rem] font-extrabold leading-tight text-night">{headline}</h1>
        {detail && <p className="text-sm text-ink/75">{detail}</p>}
        {main && art?.verse && (
          <figure className="mt-1">
            <blockquote className="text-[0.8125rem] italic leading-snug text-ink/80">« {art.verse} »</blockquote>
            {art.verseRef && <figcaption className="mt-0.5 text-xs font-semibold text-royal">{art.verseRef}</figcaption>}
          </figure>
        )}
      </div>
    </section>
  );
}
