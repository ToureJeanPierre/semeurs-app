"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCurrentArt } from "@/components/layout/PageArt";
import { ModuleIcon } from "@/components/ui/icons";

/**
 * Bandeau en tête d'onglet, sur le modèle des bannières de Jean-Pierre (30/10/2026) :
 * icône dans un carré blanc, nom de l'onglet, grand titre, texte, verset en italique et
 * référence en bleu ; l'illustration entière à droite, sur fond bleu ciel.
 * Tout vient de la table « modules » (illustration, accroche, verset) : rien n'est écrit ici.
 * `plain` garde un titre simple (fiche d'une personne).
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
  // Écran principal de l'onglet : nom de l'onglet en petit, accroche en grand, puis le verset.
  const main = !!art && pathname === art.href;
  const same = !!art && title === art.label;
  const eyebrow = art?.label;
  const headline = same ? (art.heroTitle ?? title) : title;
  const picture = art?.heroImage ?? art?.image ?? null;
  const cutout = !!art?.heroImage; // illustration détourée : affichée entière, sans fondu

  return (
    <section className="relative mb-5 overflow-hidden rounded-[1.5rem] border border-white/80 bg-gradient-to-br from-[#e9f4fe] via-[#dff0fd] to-[#d3e8fc] p-4 shadow-card print:hidden">
      {/* Ligne 1 : icône, nom de l'onglet et grand titre à gauche ; illustration en grand à droite. */}
      <div className="flex min-h-36 items-stretch gap-2">
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 py-1">
          <div className="flex items-center gap-2.5">
            {art && (
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-royal shadow-[0_6px_16px_-6px_rgb(21_70_184/0.35)]">
                <ModuleIcon name={art.icon} className="size-6" strokeWidth={1.9} />
              </span>
            )}
            {eyebrow && <p className="truncate font-display text-base font-medium text-ink/70">{eyebrow}</p>}
          </div>
          <h1 className="font-display text-[1.625rem] font-extrabold leading-[1.08] text-night">{headline}</h1>
        </div>
        {picture && (
          <div
            aria-hidden
            className="relative -my-4 -mr-4 w-[48%] shrink-0 self-stretch"
            style={
              cutout
                ? undefined
                : { maskImage: "linear-gradient(to right, transparent, black 35%)", WebkitMaskImage: "linear-gradient(to right, transparent, black 35%)" }
            }
          >
            <Image
              src={picture}
              alt=""
              fill
              sizes="200px"
              unoptimized
              priority
              className={cutout ? "scale-110 object-contain object-center" : "object-cover"}
            />
          </div>
        )}
      </div>
      {/* Ligne 2 : texte et verset sur toute la largeur, lisibles sur un petit écran. */}
      {(intro || (main && art?.verse)) && (
        <div className="mt-3 flex flex-col gap-2 border-t border-white/70 pt-3">
          {intro && <p className="text-[0.9375rem] leading-snug text-ink/80">{intro}</p>}
          {main && art?.verse && (
            <figure>
              <blockquote className="text-sm italic leading-snug text-ink/75">« {art.verse} »</blockquote>
              {art.verseRef && <figcaption className="mt-1 font-display text-sm font-bold text-royal">{art.verseRef}</figcaption>}
            </figure>
          )}
        </div>
      )}
    </section>
  );
}
