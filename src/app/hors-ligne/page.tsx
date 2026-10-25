import type { Metadata } from "next";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = { title: "Hors connexion" };

export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <WifiOff aria-hidden className="size-12 text-royal" strokeWidth={1.8} />
      <h1 className="text-2xl font-semibold">Pas de réseau</h1>
      <p className="max-w-sm text-muted">
        Vérifiez votre connexion internet, puis rouvrez l&apos;application. Vos informations
        n&apos;ont pas été perdues.
      </p>
    </main>
  );
}
