import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCog, Pencil, Plus, UsersRound } from "lucide-react";
import { CancelServiceButton } from "@/components/program/CancelServiceButton";
import { PageTitle } from "@/components/admin/AdminCard";
import { ServiceCard } from "@/components/program/ServiceCard";
import { getAccess, hasAny } from "@/lib/access";
import { addDays, formatMonth, todayIso } from "@/lib/format";
import { loadProgram } from "@/lib/program";

export const metadata: Metadata = { title: "Cultes" };

/** Programme des cultes publié : qui modère, qui prêche, quel thème. */
export default async function ServicesPage() {
  const access = await getAccess();
  const manager = hasAny(access, ["program.manage"]);
  const today = todayIso();
  const services = (await loadProgram(today, addDays(today, 62))).filter((s) => s.published);

  // Regroupés par mois
  const months = new Map<string, typeof services>();
  for (const s of services) {
    const key = s.service_date.slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), s]);
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title="Programme des cultes" intro="Modérateurs, prédicateurs et thèmes des deux prochains mois." />
      {manager && (
        <Link href="/cultes/ajouter" className="flex min-h-13 items-center justify-center gap-2 rounded-card bg-gold font-semibold text-night shadow-card">
          <Plus aria-hidden className="size-5" /> Ajouter un culte
        </Link>
      )}
      {manager && (
        <div className="grid grid-cols-2 gap-3">
          <Link href="/cultes/programme" className="flex min-h-14 items-center justify-center gap-2 rounded-card bg-royal px-3 text-center font-semibold text-white shadow-card">
            <CalendarCog aria-hidden className="size-5 shrink-0" /> Préparer
          </Link>
          <Link href="/cultes/viviers" className="flex min-h-14 items-center justify-center gap-2 rounded-card bg-surface px-3 text-center font-semibold text-royal shadow-card">
            <UsersRound aria-hidden className="size-5 shrink-0" /> Viviers
          </Link>
        </div>
      )}
      {services.length === 0 && (
        <p className="rounded-card bg-surface p-4 text-muted">
          Le programme n&apos;est pas encore publié.{manager ? " Touchez « Préparer » pour le générer." : ""}
        </p>
      )}
      {[...months.entries()].map(([month, list]) => (
        <section key={month} className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-semibold first-letter:uppercase">{formatMonth(`${month}-01`)}</h2>
          {list.map((s) => (
            <ServiceCard key={s.service_id} service={s} highlight={access.personId}>
              {manager && (
                <div className="flex items-start justify-between gap-2 border-t border-line pt-2">
                  <Link
                    href={`/cultes/programme?du=${s.service_date}#culte-${s.service_id}`}
                    className="flex min-h-11 items-center gap-1 text-sm font-semibold text-royal"
                  >
                    <Pencil aria-hidden className="size-4" /> Modifier
                  </Link>
                  <CancelServiceButton serviceId={s.service_id} published={s.published} />
                </div>
              )}
            </ServiceCard>
          ))}
        </section>
      ))}
    </div>
  );
}
