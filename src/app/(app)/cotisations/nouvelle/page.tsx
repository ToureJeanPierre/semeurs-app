import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageTitle } from "@/components/admin/AdminCard";
import { PersonPicker } from "@/components/admin/PersonPicker";
import { ActionForm } from "@/components/people/ActionForm";
import { Card } from "@/components/ui/Card";
import { SelectField, TextAreaField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { getAccess, hasAny } from "@/lib/access";
import { loadPeopleOptions } from "@/lib/admin";
import { loadValueList } from "@/lib/people";
import { createClient } from "@/lib/supabase/server";
import { createHeading } from "../actions";

export const metadata: Metadata = { title: "Lancer une cotisation" };

const param = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/**
 * Nouvelle rubrique de cotisation. Peut être pré-remplie depuis un événement de vie
 * (?evenement=…&beneficiaire=…&type=…&groupe=…&titre=…).
 */
export default async function NewContributionPage({ searchParams }: PageProps<"/cotisations/nouvelle">) {
  const params = await searchParams;
  const access = await getAccess();
  const supabase = await createClient();
  const [{ data: groups }, kinds, people] = await Promise.all([
    supabase.rpc("my_groups_with", { p_permission: "contributions.manage" }),
    loadValueList("contribution_kind"),
    loadPeopleOptions(),
  ]);
  const church = hasAny(access, ["contributions.manage"]);
  const scopes = [
    ...(church ? [{ value: "church", label: "Toute l'église" }] : []),
    ...((groups ?? []) as { id: string; name: string; type_name: string }[]).map((g) => ({ value: g.id, label: `${g.name} (${g.type_name})` })),
  ];
  if (scopes.length === 0) redirect("/cotisations");
  const wantedGroup = param(params.groupe);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title="Lancer une cotisation" intro="Mariage, décès, naissance, maladie, cotisation mensuelle, projet…" />
      <Card className="shadow-card">
        <ActionForm action={createHeading} hidden={{ life_event_id: param(params.evenement) ?? "" }} submitLabel="Lancer la cotisation" variant="primary">
          <TextField label="Titre" name="title" defaultValue={param(params.titre)} placeholder="Soutien à la famille Kouassi" required />
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Type" name="kind" options={kinds} defaultValue={param(params.type) ?? "support"} />
            <SelectField
              label="Qui cotise"
              name="group_id"
              options={scopes}
              defaultValue={wantedGroup && scopes.some((s) => s.value === wantedGroup) ? wantedGroup : scopes[0].value}
            />
          </div>
          <PersonPicker name="beneficiary_id" label="Bénéficiaire (facultatif)" people={people} defaultId={param(params.beneficiaire)} />
          <SelectField
            label="Montant"
            name="amount_mode"
            options={[
              { value: "free", label: "Libre (chacun donne selon son cœur)" },
              { value: "fixed", label: "Fixe (même montant pour tous)" },
            ]}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Montant fixe (FCFA)" name="amount" inputMode="numeric" hint="Si montant fixe" />
            <TextField label="Minimum (FCFA)" name="min_amount" inputMode="numeric" hint="Si montant libre" />
            <TextField label="Objectif (FCFA)" name="target_amount" inputMode="numeric" hint="Facultatif" />
            <TextField label="Échéance" name="due_date" type="date" />
          </div>
          <SelectField
            label="Récurrence"
            name="recurrence"
            options={[
              { value: "none", label: "Une seule fois" },
              { value: "monthly", label: "Chaque mois" },
            ]}
          />
          <TextAreaField label="Message aux membres (facultatif)" name="description" maxLength={1000} />
        </ActionForm>
      </Card>
    </div>
  );
}
