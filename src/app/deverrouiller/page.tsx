import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { UnlockPanel } from "@/components/auth/UnlockPanel";

export const metadata: Metadata = { title: "Déverrouiller" };

export default function UnlockPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <Logo size={96} priority />
        <div>
          <h1 className="text-2xl font-semibold">Application verrouillée</h1>
          <p className="mt-1 text-muted">
            Posez votre doigt ou tracez votre schéma pour continuer.
          </p>
        </div>
        <div className="w-full">
          <UnlockPanel />
        </div>
      </div>
    </main>
  );
}
