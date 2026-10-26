import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Reveal } from "@/components/ui/Reveal";
import { ModuleIcon } from "@/components/ui/icons";
import { requireUser } from "@/lib/auth/session";
import { loadModules } from "@/lib/navigation";

export const metadata: Metadata = { title: "Bientôt disponible" };

/** Page d'attente d'un module pas encore livré (table « modules », enabled = false). */
export default async function ModulePage({ params }: PageProps<"/m/[code]">) {
  await requireUser();
  const { code } = await params;
  const mod = (await loadModules()).find((m) => m.code === code);
  if (!mod) notFound();

  return (
    <AppShell title={mod.label}>
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-5 px-6 py-12 text-center">
        <Reveal variant="pop">
          <span className="relative grid size-28 place-items-center">
            <span aria-hidden className="absolute inset-0 animate-glow rounded-full bg-sky/30 blur-xl" />
            <span className="relative grid size-24 animate-float place-items-center rounded-3xl bg-gradient-to-b from-royal to-night text-white shadow-float">
              <ModuleIcon name={mod.icon} className="size-12" strokeWidth={1.7} />
            </span>
          </span>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="inline-block rounded-full bg-gold/20 px-3 py-1 text-sm font-semibold text-night">
            Bientôt disponible
          </p>
          <h2 className="mt-3 text-2xl font-semibold">{mod.label}</h2>
          {mod.description && <p className="mt-1 text-muted">{mod.description}</p>}
        </Reveal>
        <Reveal delay={0.24}>
          <Link
            href="/"
            className="inline-flex min-h-12 items-center rounded-full bg-royal px-6 font-semibold text-white"
          >
            Retour à l&apos;accueil
          </Link>
        </Reveal>
      </div>
    </AppShell>
  );
}
