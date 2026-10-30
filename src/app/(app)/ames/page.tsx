import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle, Phone, UserPlus } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { ListItem } from "@/components/ui/ListItem";
import { moduleImage } from "@/lib/navigation";
import { Card } from "@/components/ui/Card";
import { getAccess, hasAny } from "@/lib/access";
import { telHref, whatsappHref } from "@/lib/contact-links";
import { addDays, formatShortDay, todayIso } from "@/lib/format";
import { loadValueList } from "@/lib/people";
import { isStepDone, nextStep, type Soul, type Step } from "@/lib/souls";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Âmes" };

/** Les âmes que l'on accompagne : parcours d'intégration, prochaine étape, gagneur. */
export default async function SoulsPage({ searchParams }: PageProps<"/ames">) {
  const params = await searchParams;
  const access = await getAccess();
  const supabase = await createClient();
  const [{ data }, { data: steps }, statuses, { data: stats }] = await Promise.all([
    supabase.rpc("souls_overview"),
    supabase.from("integration_steps").select("id, code, label, position, due_days").eq("active", true).order("position"),
    loadValueList("person_status"),
    hasAny(access, ["souls.manage"]) ? supabase.rpc("soul_winner_stats") : Promise.resolve({ data: null }),
  ]);
  const all = (data ?? []) as Soul[];
  const mineOnly = params.vue === "miennes";
  const souls = mineOnly ? all.filter((s) => s.brought_by === access.personId) : all;
  const stepList = (steps ?? []) as Step[];
  const today = todayIso();
  const manager = hasAny(access, ["souls.manage"]);
  const monthStart = addDays(today, -30);
  const art = await moduleImage("souls");
  const statusLabel = (s: string) => statuses.find((x) => x.value === s)?.label ?? s;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title="Âmes" intro="Accueillir, appeler, accompagner jusqu'à l'intégration dans une famille." />
      <Link href="/ames/nouvelle" className="flex min-h-14 items-center justify-center gap-2 rounded-card bg-royal px-3 text-center font-semibold text-white shadow-card">
        <UserPlus aria-hidden className="size-5 shrink-0" /> Nouvelle âme
      </Link>

      {manager && (
        <ul className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Suivies", all.length],
            ["Ce mois-ci", all.filter((s) => (s.arrived_at ?? "") >= monthStart).length],
            ["En famille", all.filter((s) => s.in_family).length],
          ].map(([label, n]) => (
            <li key={label} className="rounded-card bg-surface p-3 shadow-card">
              <p className="font-display text-2xl font-bold text-royal">{n}</p>
              <p className="text-xs text-muted">{label}</p>
            </li>
          ))}
        </ul>
      )}

      <nav aria-label="Filtre" className="flex gap-2">
        {[
          ["", "Toutes"],
          ["miennes", "Celles que j'ai amenées"],
        ].map(([value, label]) => (
          <Link
            key={value}
            href={value ? `/ames?vue=${value}` : "/ames"}
            className={`flex min-h-11 items-center rounded-full px-4 text-sm font-semibold ${(params.vue ?? "") === value ? "bg-royal text-white" : "bg-surface text-royal shadow-card"}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {souls.length === 0 && (
        <p className="rounded-card bg-surface p-4 text-muted">
          Aucune âme à accompagner ici. Vous avez invité quelqu&apos;un au culte ? Touchez « Nouvelle âme » : vous en serez le gagneur.
        </p>
      )}
      {souls.map((s) => {
        const next = nextStep(s, stepList, today);
        const done = stepList.filter((st) => isStepDone(s, st.code)).length;
        return (
          <ListItem
            key={s.id}
            title={<Link href={`/ames/${s.id}`}>{`${s.last_name.toUpperCase()} ${s.first_name}`}</Link>}
            tone={next?.late ? "rose" : next ? "green" : "teal"}
            image={art}
            icon="sprout"
            badge={statusLabel(s.status)}
            meta={[
              ...(s.arrived_at ? [{ icon: "clock" as const, text: `Arrivé(e) le ${formatShortDay(s.arrived_at)}` }] : []),
              ...(s.brought_by_name ? [{ icon: "person" as const, text: `Amené(e) par ${s.brought_by_name}` }] : []),
            ]}
          >
              <span className="h-2 overflow-hidden rounded-full bg-line" aria-hidden>
                <span className="block h-full rounded-full bg-ok-ring" style={{ width: `${(done / Math.max(1, stepList.length)) * 100}%` }} />
              </span>
              <span className="text-sm">
                {next ? (
                  <span className={next.late ? "font-semibold text-alert-text" : "text-muted"}>
                    Prochaine étape : {next.step.label}
                    {next.late ? " (en retard)" : ""}
                  </span>
                ) : (
                  <span className="font-semibold text-ok-text">Parcours terminé, gloire à Dieu !</span>
                )}
              </span>
            {!s.phone && (
              <Link
                href={`/fideles/${s.id}`}
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-full border-2 border-dashed border-warn-ring bg-warn-bg text-sm font-semibold text-warn-text"
              >
                <Phone aria-hidden className="size-4" /> Pas de numéro : l&apos;ajouter
              </Link>
            )}
            {s.phone && (
              <div className="grid grid-cols-2 gap-2">
                <a href={telHref(s.phone)} className="flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-royal text-sm font-semibold text-white">
                  <Phone aria-hidden className="size-4" /> Appeler
                </a>
                <a
                  href={whatsappHref(s.phone)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-[#1f8f4e] text-sm font-semibold text-white"
                >
                  <MessageCircle aria-hidden className="size-4" /> WhatsApp
                </a>
              </div>
            )}
            <Link href={`/ames/${s.id}`} className="flex min-h-11 items-center justify-center rounded-full bg-royal/10 text-sm font-semibold text-royal">
              Voir son parcours
            </Link>
          </ListItem>
        );
      })}

      {manager && (stats ?? []).length > 0 && (
        <Card className="flex flex-col gap-2 shadow-card">
          <h2 className="text-lg font-semibold">Gagneurs d&apos;âmes</h2>
          <ul className="flex flex-col divide-y divide-line text-sm">
            {((stats ?? []) as { person_id: string; name: string; souls: number; integrated: number }[]).map((g) => (
              <li key={g.person_id} className="flex min-h-11 items-center justify-between gap-2">
                <span className="font-semibold">{g.name}</span>
                <span className="text-muted">
                  {g.souls} amenée{g.souls > 1 ? "s" : ""} · {g.integrated} en famille
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
