import type { Metadata } from "next";
import { PageTitle } from "@/components/admin/AdminCard";
import { ActionForm } from "@/components/people/ActionForm";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { requirePermission } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { addIntegrationStep, addValueItem, updateIntegrationStep, updateValueItem } from "../actions";

export const metadata: Metadata = { title: "Listes" };

/** Noms lisibles des listes connues ; une liste nouvelle s'affiche avec son code. */
const LIST_NAMES: Record<string, string> = {
  person_status: "Statuts des fidèles",
  marital_status: "Situations familiales",
  unattached_reason: "Motifs « sans famille »",
  absence_reason: "Motifs d'absence",
  contact_channel: "Moyens de contact (suivi)",
  contact_result: "Résultats d'un contact",
  contribution_kind: "Types de cotisation",
  payment_method: "Moyens de paiement",
  life_event_kind: "Événements de vie",
  outreach_decision: "Réponses en évangélisation",
  resource_kind: "Types de ressources (répertoire)",
};

type Item = { id: string; list_code: string; value: string; label: string; active: boolean; position: number };
type StepRow = { id: string; label: string; due_days: number | null; active: boolean; position: number };

const inputCls = "min-h-11 min-w-0 flex-1 rounded-xl border-2 border-line bg-surface px-3";

/** Listes de valeurs et parcours d'intégration : modifiables par l'administrateur, sans développeur. */
export default async function ListsPage() {
  await requirePermission("settings.manage");
  const supabase = await createClient();
  const [{ data: items }, { data: steps }] = await Promise.all([
    supabase.from("value_lists").select("id, list_code, value, label, active, position").order("list_code").order("position"),
    supabase.from("integration_steps").select("id, label, due_days, active, position").order("position"),
  ]);
  const lists = new Map<string, Item[]>();
  for (const i of (items ?? []) as Item[]) lists.set(i.list_code, [...(lists.get(i.list_code) ?? []), i]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title="Listes" intro="Renommez, désactivez ou ajoutez des choix. Une valeur désactivée reste dans l'historique." />

      <Card className="flex flex-col gap-2 shadow-card">
        <h2 className="text-lg font-semibold">Parcours d&apos;intégration</h2>
        <p className="text-sm text-muted">Délai conseillé : nombre de jours après l&apos;arrivée (vide = sans délai).</p>
        {((steps ?? []) as StepRow[]).map((s) => (
          <form key={s.id} action={updateIntegrationStep} className="flex items-center gap-2">
            <input type="hidden" name="id" value={s.id} />
            <input name="label" defaultValue={s.label} aria-label="Libellé de l'étape" className={inputCls} />
            <input name="due_days" defaultValue={s.due_days ?? ""} inputMode="numeric" aria-label="Délai en jours" className="min-h-11 w-14 rounded-xl border-2 border-line bg-surface px-2 text-center" />
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" name="active" defaultChecked={s.active} className="size-5 accent-royal" /> Active
            </label>
            <SubmitButton className="min-h-11 rounded-full bg-royal/10 px-3 text-sm font-semibold text-royal">OK</SubmitButton>
          </form>
        ))}
        <ActionForm action={addIntegrationStep} submitLabel="Ajouter l'étape">
          <TextField label="Nouvelle étape" name="label" placeholder="Rencontre avec le pasteur" />
        </ActionForm>
      </Card>

      {[...lists.entries()].map(([code, list]) => (
        <details key={code} className="rounded-card bg-surface px-4 shadow-card">
          <summary className="flex min-h-14 cursor-pointer items-center justify-between font-semibold">
            {LIST_NAMES[code] ?? code}
            <span className="text-sm font-normal text-muted">{list.filter((i) => i.active).length} choix</span>
          </summary>
          <div className="flex flex-col gap-2 pb-4">
            {list.map((i) => (
              <form key={i.id} action={updateValueItem} className="flex items-center gap-2">
                <input type="hidden" name="id" value={i.id} />
                <input name="label" defaultValue={i.label} aria-label={`Libellé (${i.value})`} className={inputCls} />
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" name="active" defaultChecked={i.active} className="size-5 accent-royal" /> Actif
                </label>
                <SubmitButton className="min-h-11 rounded-full bg-royal/10 px-3 text-sm font-semibold text-royal">OK</SubmitButton>
              </form>
            ))}
            <ActionForm action={addValueItem} hidden={{ list_code: code }} submitLabel="Ajouter">
              <TextField label="Nouveau choix" name="label" />
            </ActionForm>
          </div>
        </details>
      ))}
    </div>
  );
}
