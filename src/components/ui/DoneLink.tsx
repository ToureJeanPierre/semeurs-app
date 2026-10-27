import Link from "next/link";
import { Check } from "lucide-react";

/** Bouton de fin d'opération : ramène à la liste, sans quitter l'application. */
export function DoneLink({ href, label = "Terminer" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-royal px-6 text-base font-semibold text-white shadow-float"
    >
      <Check aria-hidden className="size-5" />
      {label}
    </Link>
  );
}
