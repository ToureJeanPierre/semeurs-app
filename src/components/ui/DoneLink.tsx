"use client";

import { Check } from "lucide-react";
import { useNavTrail } from "@/components/layout/NavTrail";

/**
 * Bouton de fin d'opération : revient à la liste par le chemin parcouru
 * (sans boucle dans l'historique), sans jamais quitter l'application.
 */
export function DoneLink({ href, label = "Terminer" }: { href: string; label?: string }) {
  const { done } = useNavTrail();
  return (
    <button
      type="button"
      onClick={() => done(href)}
      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-royal px-6 text-base font-semibold text-white shadow-float"
    >
      <Check aria-hidden className="size-5" />
      {label}
    </button>
  );
}
