import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { UnlockPanel } from "@/components/auth/UnlockPanel";
import { HeroSky } from "@/components/ui/HeroSky";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = { title: "Déverrouiller" };

export default function UnlockPage() {
  return (
    <main className="flex flex-1 flex-col">
      <HeroSky className="px-6 pb-20 pt-14 text-center">
        <Reveal variant="pop" className="flex justify-center">
          <span className="relative grid size-32 place-items-center">
            <span aria-hidden className="absolute inset-0 animate-glow rounded-full bg-sky/50 blur-2xl" />
            <span className="relative animate-float rounded-full bg-white p-1.5 shadow-float">
              <Logo size={104} priority />
            </span>
          </span>
        </Reveal>
        <Reveal delay={0.15} className="mt-5">
          <h1 className="text-2xl font-extrabold">Application verrouillée</h1>
          <p className="mt-1 text-white/85">Posez votre doigt ou tracez votre schéma pour continuer.</p>
        </Reveal>
      </HeroSky>
      <Reveal delay={0.25} className="relative -mt-6 px-4 pb-10">
        <div className="mx-auto w-full max-w-sm rounded-[var(--radius-sheet)] bg-surface p-6 shadow-card">
          <UnlockPanel />
        </div>
      </Reveal>
    </main>
  );
}
