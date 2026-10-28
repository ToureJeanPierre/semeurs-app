import type { Metadata } from "next";
import { PageTitle } from "@/components/admin/AdminCard";
import { PersonPicker } from "@/components/admin/PersonPicker";
import { ActionForm } from "@/components/people/ActionForm";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { getAccess, hasAny } from "@/lib/access";
import { loadPeopleOptions } from "@/lib/admin";
import { loadValueList } from "@/lib/people";
import { createClient } from "@/lib/supabase/server";
import { registerSoul } from "../actions";

export const metadata: Metadata = { title: "Nouvelle âme" };

/** Fiche rapide de première visite : quelques champs, le reste viendra avec l'accompagnement. */
export default async function NewSoulPage() {
  const access = await getAccess();
  const manager = hasAny(access, ["souls.manage", "people.manage"]);
  const supabase = await createClient();
  const [{ data: setting }, statuses, people] = await Promise.all([
    supabase.from("settings").select("value").eq("key", "soul_statuses").maybeSingle(),
    loadValueList("person_status"),
    manager ? loadPeopleOptions() : Promise.resolve([]),
  ]);
  const allowed = (setting?.value as string[] | undefined) ?? ["visitor", "new_convert", "integrating"];

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title="Nouvelle âme" intro="Le jour même : une fiche rapide, puis le message de bienvenue." />
      <Card className="shadow-card">
        <ActionForm action={registerSoul} submitLabel="Enregistrer" variant="primary">
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Nom" name="last_name" autoCapitalize="characters" required />
            <TextField label="Prénom(s)" name="first_name" required />
          </div>
          <TextField label="Téléphone" name="phone" type="tel" inputMode="tel" prefix="+225" />
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Sexe" name="sex" options={[{ value: "", label: "—" }, { value: "F", label: "Femme" }, { value: "M", label: "Homme" }]} />
            <SelectField label="Statut" name="status" options={statuses.filter((s) => allowed.includes(s.value))} />
          </div>
          <TextField label="Quartier" name="district" placeholder="Niangon" />
          {manager ? (
            <PersonPicker name="brought_by" label="Amené(e) par (gagneur d'âme)" people={people} defaultId={access.personId} />
          ) : (
            <p className="rounded-2xl bg-gold/15 px-3 py-2 text-sm">Vous serez enregistré(e) comme son gagneur d&apos;âme : vous pourrez suivre son parcours.</p>
          )}
          <TextField label="Note (facultatif)" name="note" placeholder="Rencontré(e) au marché, prier pour son travail" />
        </ActionForm>
      </Card>
    </div>
  );
}
