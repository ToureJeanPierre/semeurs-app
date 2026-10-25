import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { LightRays } from "@/components/ui/LightRays";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="relative overflow-hidden bg-royal px-6 pb-16 pt-12 text-center text-white">
        <LightRays />
        <div className="relative flex flex-col items-center gap-4">
          <div className="rounded-full bg-white p-1.5 shadow-float">
            <Logo size={112} priority />
          </div>
          <div>
            <p className="text-sm font-medium text-white/85">Église évangélique</p>
            <h1 className="text-3xl font-extrabold">Les Semeurs de la Parole</h1>
          </div>
        </div>
      </header>

      <section className="relative -mt-8 flex-1 rounded-t-[var(--radius-sheet)] bg-cloud px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md">
          <h2 className="mb-1 text-2xl font-semibold">Bienvenue</h2>
          <p className="mb-6 text-muted">Connectez-vous pour accéder à votre espace.</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
