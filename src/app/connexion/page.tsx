import type { Metadata } from "next";
import Image from "next/image";
import { KeyRound } from "lucide-react";
import { Logo } from "@/components/Logo";
import { LoginForm } from "@/components/auth/LoginForm";
import { Reveal } from "@/components/ui/Reveal";
import { getBrand } from "@/lib/brand";

export const metadata: Metadata = { title: "Connexion" };

/**
 * Connexion, dans le style des onglets (retour de Jean-Pierre du 13/11/2026) : fond clair, bandeau
 * illustré comme ses bannières (logo dans un carré blanc, nom de l'église, illustration à droite),
 * puis l'encadré de connexion bien visible.
 */
export default async function LoginPage() {
  const brand = await getBrand();
  const admin = brand.kind === "admin";
  return (
    <main className="flex flex-1 flex-col bg-[radial-gradient(120%_45%_at_50%_0%,#dcecff_0%,transparent_70%)] px-4 pb-10 pt-8">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <Reveal variant="pop">
          <section className="relative overflow-hidden rounded-[1.75rem] border border-white/80 bg-gradient-to-br from-[#e9f4fe] via-[#dff0fd] to-[#cfe3fc] p-5 shadow-card">
            <div className="flex min-h-40 items-stretch gap-2">
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
                <span className="w-fit rounded-full bg-white p-1 shadow-[0_8px_20px_-8px_rgb(21_70_184/0.45)]">
                  <Logo size={64} priority />
                </span>
                <div>
                  <p className="font-display text-sm font-medium text-ink/70">Église évangélique</p>
                  <h1 className="font-display text-[1.6rem] font-extrabold leading-[1.08] text-night">Les Semeurs de la Parole</h1>
                </div>
                {admin && (
                  <span className="w-fit rounded-full bg-gold px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-night">Administration</span>
                )}
              </div>
              <div aria-hidden className="relative -my-5 -mr-5 w-[44%] shrink-0">
                <Image src="/images/heroes/services.webp" alt="" fill sizes="200px" priority className="scale-110 object-contain object-center" />
              </div>
            </div>
            <p className="mt-3 border-t border-white/70 pt-3 text-sm italic leading-snug text-ink/75">
              « Je suis dans la joie quand on me dit : Allons à la maison de l&apos;Éternel ! »
              <span className="mt-1 block font-display font-bold not-italic text-royal">Psaume 122:1</span>
            </p>
          </section>
        </Reveal>

        <Reveal delay={0.15}>
          <section className="relative overflow-hidden rounded-[1.5rem] border-2 border-[#bcd3f7] bg-gradient-to-b from-white to-[#eaf3ff] p-5 pt-6 shadow-card">
            <span aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-royal via-[#4f8df5] to-sky" />
            <div className="mb-4 flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-royal to-night text-white shadow-float">
                <KeyRound aria-hidden className="size-5" />
              </span>
              <span>
                <span className="block font-display text-xl font-bold leading-tight text-night">Bienvenue</span>
                <span className="block text-sm text-ink/70">
                  {admin ? "Connectez-vous à l'administration." : "Connectez-vous pour accéder à votre espace."}
                </span>
              </span>
            </div>
            <LoginForm />
          </section>
        </Reveal>
      </div>
    </main>
  );
}
