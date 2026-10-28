import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { ActionForm } from "@/components/people/ActionForm";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { getAccess, hasAny } from "@/lib/access";
import { formatLongDay, todayIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { createOuting } from "../actions";

export const metadata: Metadata = { title: "Sorties d'évangélisation" };

type Outing = { id: string; outing_date: string; zone: string; group_id: string | null; outreach_contacts: { decision: string; person_id: string | null }[] };

/** Sorties d'évangélisation : date, zone, équipe ; contacts rencontrés et fiches créées. */
export default async function OutingsPage() {
  const access = await getAccess();
  const manager = hasAny(access, ["souls.manage"]);
  const supabase = await createClient();
  const [{ data }, { data: teams }] = await Promise.all([
    supabase.from("outreach_outings").select("id, outing_date, zone, group_id, outreach_contacts(decision, person_id)").order("outing_date", { ascending: false }),
    supabase.from("groups").select("id, name, group_types!inner(slug)").eq("group_types.slug", "team").eq("active", true).order("name"),
  ]);
  const outings = (data ?? []) as Outing[];
  const teamName = (id: string | null) => (teams ?? []).find((t) => t.id === id)?.name;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title="Sorties d'évangélisation" intro="Chaque contact noté sur le terrain peut devenir une fiche et entrer dans le parcours." />
      {manager && (
        <Card className="shadow-card">
          <h2 className="mb-2 text-lg font-semibold">Nouvelle sortie</h2>
          <ActionForm action={createOuting} submitLabel="Créer la sortie" variant="primary">
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Date" name="outing_date" type="date" defaultValue={todayIso()} required />
              <TextField label="Zone" name="zone" placeholder="Marché de Siporex" required />
            </div>
            <SelectField label="Équipe" name="group_id" options={[{ value: "", label: "—" }, ...(teams ?? []).map((t) => ({ value: t.id, label: t.name }))]} />
          </ActionForm>
        </Card>
      )}
      {outings.length === 0 && <p className="rounded-card bg-surface p-4 text-muted">Aucune sortie enregistrée.</p>}
      {outings.map((o) => (
        <Link key={o.id} href={`/ames/sorties/${o.id}`} className="flex items-center gap-3 rounded-card bg-surface p-4 shadow-card active:scale-[0.99]">
          <MapPin aria-hidden className="size-6 shrink-0 text-royal" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{o.zone}</span>
            <span className="block text-sm text-muted first-letter:uppercase">
              {formatLongDay(o.outing_date)}
              {teamName(o.group_id) ? ` · ${teamName(o.group_id)}` : ""}
            </span>
            <span className="block text-sm">
              {o.outreach_contacts.length} contact{o.outreach_contacts.length > 1 ? "s" : ""} ·{" "}
              {o.outreach_contacts.filter((c) => c.decision === "accepted").length} décision(s) ·{" "}
              {o.outreach_contacts.filter((c) => c.person_id).length} fiche(s)
            </span>
          </span>
          <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
        </Link>
      ))}
    </div>
  );
}
