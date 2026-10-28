"use client";

import { Printer } from "lucide-react";

/** Imprimer ou enregistrer en PDF (menu du navigateur : « Enregistrer au format PDF »). */
export function PrintButton({ label = "Imprimer ou enregistrer en PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-royal font-semibold text-white print:hidden"
    >
      <Printer aria-hidden className="size-5" /> {label}
    </button>
  );
}
