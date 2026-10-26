import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { HeroSky } from "@/components/ui/HeroSky";
import { LoginForm } from "@/components/auth/LoginForm";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col">
      <HeroSky className="px-6 pb-20 pt-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <Reveal variant="pop">
            <span className="relative grid size-36 place-items-center">
              <span aria-hidden className="absolute inset-0 animate-glow rounded-full bg-sky/50 blur-2xl" />
              <span
                aria-hidden
                className="absolute inset-0 animate-halo rounded-full"
                style={{
                  background:
                    "conic-gradient(from 0deg, var(--color-gold), transparent 30%, var(--color-sky) 55%, transparent 80%, var(--color-gold))",
                }}
              />
              <span className="relative animate-float rounded-full bg-white p-1.5 shadow-float">
                <Logo size={120} priority />
              </span>
            </span>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="text-sm font-medium text-white/85">Église évangélique</p>
            <h1 className="text-3xl font-extrabold">Les Semeurs de la Parole</h1>
          </Reveal>
        </div>
      </HeroSky>

      <Reveal delay={0.25} className="relative -mt-6 flex-1 px-4 pb-10">
        <section className="mx-auto w-full max-w-md rounded-[var(--radius-sheet)] bg-surface p-6 shadow-card">
          <h2 className="mb-1 text-2xl font-semibold">Bienvenue</h2>
          <p className="mb-6 text-muted">Connectez-vous pour accéder à votre espace.</p>
          <LoginForm />
        </section>
      </Reveal>
    </main>
  );
}
