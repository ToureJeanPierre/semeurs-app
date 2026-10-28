import { ActionForm } from "@/components/people/ActionForm";
import { PositionSelect } from "@/components/program/PositionSelect";
import { Card } from "@/components/ui/Card";
import { SelectField, TextAreaField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { generateDuties, saveDutySettings, setDutyPerson } from "@/app/(app)/mes-groupes/actions";
import { WEEKDAYS } from "@/lib/group-agenda";
import { addDays, formatLongDay, todayIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Duty = { id: string; duty_date: string; label: string; person_id: string | null; person_name: string | null };

/**
 * Planning de service ou chaîne de prière : mêmes règles (postes datés, roulement équitable
 * entre les membres, absences respectées), réglages propres au groupe.
 */
export async function DutiesSection({
  groupId,
  capability,
  settings,
  leader,
  members,
  me,
}: {
  groupId: string;
  capability: "service_planning" | "prayer_chain";
  settings: { labels?: string[]; weekdays?: number[] } | null;
  leader: boolean;
  members: { id: string; name: string }[];
  me: string | null;
}) {
  const supabase = await createClient();
  const today = todayIso();
  const { data } = await supabase.rpc("group_duties_view", { p_group: groupId, p_capability: capability, p_from: today, p_to: addDays(today, 27) });
  const duties = (data ?? []) as Duty[];
  const byDate = new Map<string, Duty[]>();
  for (const d of duties) byDate.set(d.duty_date, [...(byDate.get(d.duty_date) ?? []), d]);
  const prayer = capability === "prayer_chain";
  const title = prayer ? "Chaîne de prière" : "Planning de service";
  const labels = settings?.labels ?? [];
  const weekdays = settings?.weekdays ?? (prayer ? [0, 1, 2, 3, 4, 5, 6] : [0, 5]);

  return (
    <Card className="flex flex-col gap-3 shadow-card">
      <h2 className="text-lg font-semibold">{title}</h2>
      {duties.length === 0 && (
        <p className="text-sm text-muted">{leader ? "Réglez les postes et les jours, puis générez le planning." : "Pas encore de planning pour les 4 prochaines semaines."}</p>
      )}
      {[...byDate.entries()].map(([date, list]) => (
        <div key={date} className="rounded-2xl bg-cloud p-3">
          <h3 className="mb-1 text-sm font-semibold first-letter:uppercase">{formatLongDay(date)}</h3>
          <ul className="flex flex-col gap-1">
            {list.map((d) => (
              <li key={d.id}>
                {leader ? (
                  <PositionSelect
                    action={setDutyPerson}
                    positionId={d.id}
                    label={d.label}
                    value={d.person_id}
                    options={members}
                  />
                ) : (
                  <span className={`flex justify-between gap-2 text-sm ${d.person_id === me ? "rounded-lg bg-gold/25 px-2 py-1 font-semibold" : ""}`}>
                    <span className="text-muted">{d.label}</span>
                    <span className="font-semibold">{d.person_name ?? "À pourvoir"}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {leader && (
        <>
          <details className="rounded-xl bg-cloud px-3">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-royal">Générer le planning</summary>
            <ActionForm action={generateDuties} hidden={{ group_id: groupId, capability }} submitLabel="Générer à tour de rôle" variant="primary" className="flex flex-col gap-3 pb-3">
              <div className="grid grid-cols-2 gap-3">
                <TextField label="À partir du" name="from" type="date" defaultValue={today} />
                <SelectField label="Durée" name="weeks" defaultValue="4" options={[2, 4, 8, 13].map((w) => ({ value: String(w), label: `${w} semaines` }))} />
              </div>
              <p className="text-xs text-muted">Les postes déjà attribués sont gardés ; les absences déclarées sont respectées.</p>
            </ActionForm>
          </details>
          <details className="rounded-xl bg-cloud px-3">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-royal">Réglages : {prayer ? "créneaux" : "postes"} et jours</summary>
            <ActionForm action={saveDutySettings} hidden={{ group_id: groupId, capability }} submitLabel="Enregistrer les réglages" className="flex flex-col gap-3 pb-3">
              <TextAreaField
                label={prayer ? "Créneaux de prière (un par ligne)" : "Postes (un par ligne)"}
                name="labels"
                rows={4}
                defaultValue={labels.join("\n")}
                placeholder={prayer ? "5 h – 6 h\n12 h – 13 h\n21 h – 22 h" : "Accueil\nPlacement\nOffrandes"}
              />
              <fieldset className="flex flex-wrap gap-x-4">
                <legend className="mb-1 text-sm font-semibold">Jours</legend>
                {WEEKDAYS.map((d, i) => (
                  <label key={d} className="flex min-h-11 items-center gap-2 text-sm capitalize">
                    <input type="checkbox" name="weekdays" value={i} defaultChecked={weekdays.includes(i)} className="size-5 accent-royal" />
                    {d}
                  </label>
                ))}
              </fieldset>
            </ActionForm>
          </details>
        </>
      )}
    </Card>
  );
}
