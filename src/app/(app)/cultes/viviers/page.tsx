import type { Metadata } from "next";
import { CalendarX2, X } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { PersonPicker } from "@/components/admin/PersonPicker";
import { ActionForm } from "@/components/people/ActionForm";
import { AutoSubmitSelect } from "@/components/ui/AutoSubmitSelect";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { requirePermission } from "@/lib/access";
import { loadPeopleOptions, personName } from "@/lib/admin";
import { formatShortDay, todayIso } from "@/lib/format";
import { loadProgramSettings } from "@/lib/program";
import { createClient } from "@/lib/supabase/server";
import { addToPool, addUnavailability, removeFromPool, removeUnavailability, updatePoolDays } from "../actions";

export const metadata: Metadata = { title: "Viviers" };

const DAYS = [
  { value: "both", label: "Tous les cultes" },
  { value: "sunday", label: "Dimanche" },
  { value: "weekday", label: "Semaine" },
];

type PoolRow = { id: string; person_id: string; position: string; days: string; people: { first_name: string; last_name: string } | null };

/** Viviers de modérateurs et de prédicateurs, choisis parmi les membres ; indisponibilités. */
export default async function PoolsPage() {
  await requirePermission("program.manage");
  const supabase = await createClient();
  const today = todayIso();
  const [{ positions }, people, { data: pool }, { data: unavailable }] = await Promise.all([
    loadProgramSettings(),
    loadPeopleOptions(),
    supabase.from("speaker_pools").select("id, person_id, position, days, people(first_name, last_name)"),
    supabase
      .from("unavailabilities")
      .select("id, starts_on, ends_on, reason, people(first_name, last_name)")
      .gte("ends_on", today)
      .order("starts_on"),
  ]);
  const rows = ((pool ?? []) as unknown as PoolRow[]).filter((r) => r.people);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pb-8 pt-5">
      <PageTitle title="Viviers" intro="Qui peut modérer, qui peut prêcher. La génération répartit les passages entre ces personnes, à tour de rôle." />

      {positions.map((position) => {
        const members = rows.filter((r) => r.position === position).sort((a, b) => personName(a.people!).localeCompare(personName(b.people!), "fr"));
        return (
          <Card key={position} className="flex flex-col gap-3 shadow-card">
            <h2 className="text-lg font-semibold">
              {position}s <span className="text-sm font-normal text-muted">· {members.length}</span>
            </h2>
            {members.length > 0 && (
              <ul className="flex flex-col divide-y divide-line">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 py-2">
                    <span className="min-w-0 flex-1 truncate font-semibold">{personName(m.people!)}</span>
                    <AutoSubmitSelect action={updatePoolDays} hidden={{ id: m.id }} name="days" value={m.days} options={DAYS} ariaLabel={`Jours de ${personName(m.people!)}`} />
                    <form action={removeFromPool}>
                      <input type="hidden" name="id" value={m.id} />
                      <SubmitButton aria-label={`Retirer ${personName(m.people!)}`} className="grid size-11 place-items-center rounded-full text-alert-text hover:bg-alert-bg">
                        <X aria-hidden className="size-5" />
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <ActionForm action={addToPool} hidden={{ position }} submitLabel={`Ajouter au vivier`}>
              <PersonPicker name="person_id" label="Choisir dans la liste des membres" people={people} />
              <SelectField label="Quand" name="days" options={DAYS} />
            </ActionForm>
          </Card>
        );
      })}

      <Card className="flex flex-col gap-3 shadow-card">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CalendarX2 aria-hidden className="size-5 text-royal" /> Indisponibilités
        </h2>
        <p className="text-sm text-muted">Chacun peut aussi déclarer les siennes dans « Mon espace ».</p>
        {(unavailable ?? []).length > 0 && (
          <ul className="flex flex-col divide-y divide-line">
            {((unavailable ?? []) as unknown as { id: string; starts_on: string; ends_on: string; reason: string | null; people: { first_name: string; last_name: string } | null }[]).map((u) => (
              <li key={u.id} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{u.people ? personName(u.people) : ""}</span>
                  <span className="block text-sm text-muted">
                    {u.starts_on === u.ends_on ? formatShortDay(u.starts_on) : `${formatShortDay(u.starts_on)} → ${formatShortDay(u.ends_on)}`}
                    {u.reason ? ` · ${u.reason}` : ""}
                  </span>
                </span>
                <form action={removeUnavailability}>
                  <input type="hidden" name="id" value={u.id} />
                  <SubmitButton aria-label="Retirer" className="grid size-11 place-items-center rounded-full text-alert-text hover:bg-alert-bg">
                    <X aria-hidden className="size-5" />
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
        <ActionForm action={addUnavailability} submitLabel="Enregistrer l'indisponibilité">
          <PersonPicker name="person_id" label="Personne" people={people} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Du" name="starts_on" type="date" defaultValue={today} required />
            <TextField label="Au" name="ends_on" type="date" defaultValue={today} required />
          </div>
          <TextField label="Motif (facultatif)" name="reason" />
        </ActionForm>
      </Card>
    </div>
  );
}
