import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { UnlockPanel } from "@/components/auth/UnlockPanel";

export const metadata: Metadata = { title: "Déverrouiller" };

/** Écran de déverrouillage épuré : fond bleu, logo, et la demande d'empreinte ou de schéma. */
export default function UnlockPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 bg-gradient-to-b from-royal to-night px-6 py-12">
      <div className="flex flex-col items-center gap-3 text-center text-white">
        <Logo size={104} priority />
        <h1 className="font-display text-2xl font-semibold">Les Semeurs de la Parole</h1>
      </div>
      <UnlockPanel />
    </main>
  );
}
