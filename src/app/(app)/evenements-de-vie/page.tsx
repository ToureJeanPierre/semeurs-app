import type { Metadata } from "next";
import Link from "next/link";
import { HandCoins, House } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { PersonPicker } from "@/components/admin/PersonPicker";
import { ActionForm } from "@/components/people/ActionForm";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { getAccess, hasAny } from "@/lib/access";
import { loadPeopleOptions, personName } from "@/lib/admin";
import { addDays, formatFullDate, todayIso } from "@/lib/format";
import { loadValueList } from "@/lib/people";
import { createClient } from "@/lib/supabase/server";
import { closeLifeEvent, planVisit, reportLifeEvent } from "./actions";

export const metadata: Metadata = { title: "Événements de vie" };

type EventRow = {
  id: string;
  person_id: string;
  kind: string;
  event_date: string;
  note: string | null;
  status: string;
  person: { first_name: string; last_name: string } | null;
};

/** Naissance, mariage, deuil, hospitalisation : signaler, puis accompagner (cotisation, visite). */
export default async function LifeEventsPage() {
  const access = await getAccess();
  const supabase = await createClient();
  const [{ data }, kinds, people, { data: memberships }, { data: managedGroups }, { data: headings }] = await Promise.all([
    supabase
      .from("life_events")
      .select("id, person_id, kind, event_date, note, status, person:people!life_events_person_id_fkey(first_name, last_name)")
      .gte("event_date", addDays(todayIso(), -120))
      .order("event_date", { ascending: false }),
    loadValueList("life_event_kind"),
    loadPeopleOptions(),
    supabase.from("group_memberships").select("person_id, group_id, groups!inner(group_types!inner(slug))").eq("groups.group_types.slug", "family").is("end_date", null),
    supabase.rpc("my_groups_with", { p_permission: "contributions.manage" }),
    supabase.from("contribution_headings").select("id, life_event_id").not("life_event_id", "is", null),
  ]);
  const headingOf = new Map(((headings ?? []) as { id: string; life_event_id: string }[]).map((h) => [h.life_event_id, h.id]));
  const events = (data ?? []) as unknown as EventRow[];
  const familyOf = new Map(((memberships ?? []) as { person_id: string; group_id: string }[]).map((m) => [m.person_id, m.group_id]));
  const churchContrib = hasAny(access, ["contributions.manage"]);
  const managed = new Set(((managedGroups ?? []) as { id: string }[]).map((g) => g.id));
  const followsSomeone = hasAny(access, ["alerts.manage"], "any");
  const kindLabel = (k: string) => kinds.find((x) => x.value === k)?.label ?? k;
  const options = people.some((p) => p.id === access.personId) ? people : [{ id: access.personId ?? "", name: "Moi-même" }, ...people];

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pb-8 pt-5">
      <PageTitle title="Événements de vie" intro="Une naissance, un mariage, un deuil, une hospitalisation ? Prévenez : l'église accompagne." />

      <Card className="flex flex-col gap-3 shadow-card">
        <h2 className="text-lg font-semibold">Signaler</h2>
        <ActionForm action={reportLifeEvent} submitLabel="Prévenir le père de famille et le pasteur" variant="primary">
          <PersonPicker name="person_id" label="Qui est concerné" people={options} defaultId={access.personId} />
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Événement" name="kind" options={kinds} />
            <TextField label="Date" name="event_date" type="date" defaultValue={todayIso()} required />
          </div>
          <TextField label="Précision (facultatif)" name="note" placeholder="Hospitalisé au CHU de Yopougon" />
        </ActionForm>
      </Card>

      <section className="flex flex-col gap-3" aria-labelledby="recents">
        <h2 id="recents" className="text-lg font-semibold">Récents</h2>
        {events.length === 0 && <p className="rounded-card bg-surface p-4 text-muted">Aucun événement signalé ces derniers mois.</p>}
        {events.map((e) => {
          const family = familyOf.get(e.person_id);
          const headingId = headingOf.get(e.id);
          const canOpenContribution = !headingId && (churchContrib || (family && managed.has(family)));
          const label = `${kindLabel(e.kind)} : ${e.person ? personName(e.person) : ""}`;
          return (
            <Card key={e.id} className={`flex flex-col gap-2 shadow-card ${e.status === "closed" ? "opacity-70" : ""}`}>
              <p>
                <span className="block font-semibold">{label}</span>
                <span className="block text-sm text-muted">
                  {formatFullDate(e.event_date)}
                  {e.note ? ` · ${e.note}` : ""}
                  {e.status === "closed" ? " · clos" : ""}
                </span>
              </p>
              {headingId && (
                <Link href={`/cotisations/${headingId}`} className="flex min-h-11 items-center gap-2 text-sm font-semibold text-royal">
                  <HandCoins aria-hidden className="size-5" /> Voir la cotisation de soutien
                </Link>
              )}
              {e.status === "open" && (
                <div className="flex flex-col gap-2">
                  {canOpenContribution && (
                    <Link
                      href={`/cotisations/nouvelle?${new URLSearchParams({
                        evenement: e.id,
                        beneficiaire: e.person_id,
                        type: ["birth", "wedding", "death", "illness"].includes(e.kind) ? e.kind : "support",
                        titre: `Soutien à ${e.person ? `${e.person.first_name} ${e.person.last_name}` : ""} (${kindLabel(e.kind).toLowerCase()})`,
                        ...(family ? { groupe: family } : {}),
                      }).toString()}`}
                      className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-gold font-semibold text-night"
                    >
                      <HandCoins aria-hidden className="size-5" /> Ouvrir une cotisation de soutien
                    </Link>
                  )}
                  {followsSomeone && (
                    <details className="rounded-xl bg-cloud px-3">
                      <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-royal">
                        <House aria-hidden className="size-4" /> Prévoir une visite
                      </summary>
                      <ActionForm action={planVisit} hidden={{ event_id: e.id, person_id: e.person_id, label: kindLabel(e.kind).toLowerCase() }} submitLabel="Inscrire la visite" className="flex flex-col gap-3 pb-3">
                        <TextField label="Date de la visite" name="date" type="date" defaultValue={addDays(todayIso(), 1)} required />
                      </ActionForm>
                    </details>
                  )}
                  {followsSomeone && (
                    <form action={closeLifeEvent} className="self-end">
                      <input type="hidden" name="event_id" value={e.id} />
                      <SubmitButton className="min-h-11 rounded-full px-3 text-sm font-semibold text-muted hover:bg-cloud">Marquer comme accompagné</SubmitButton>
                    </form>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </section>
    </div>
  );
}
