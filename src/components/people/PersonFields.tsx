"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";
import { FormFeedback } from "@/components/admin/FormFeedback";
import { PersonPicker, type PersonOption } from "@/components/admin/PersonPicker";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

export type ValueOption = { value: string; label: string };

export type PersonValues = {
  id?: string;
  last_name: string;
  first_name: string;
  sex: string | null;
  birth_date: string | null;
  phone: string | null;
  whatsapp: string | null;
  relative_phone: string | null;
  commune: string | null;
  district: string | null;
  landmark: string | null;
  status: string;
  marital_status: string | null;
  arrived_at: string | null;
  baptized_at: string | null;
  brought_by: string | null;
  unattached_reason: string | null;
  weekday_exempt: boolean;
};

function Select({
  label,
  name,
  options,
  defaultValue,
  empty,
}: {
  label: string;
  name: string;
  options: ValueOption[];
  defaultValue: string | null;
  empty?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="min-h-13 rounded-2xl border-2 border-line bg-surface px-3 text-base focus:border-ink/40"
      >
        {empty !== undefined && <option value="">{empty}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-card bg-surface p-4 shadow-card">
      <legend className="float-left mb-1 w-full font-display text-lg font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

/** Champs de la fiche fidèle (docs/01 §6.1). Les listes viennent des listes de valeurs. */
export function PersonFields({
  action,
  values,
  people,
  statuses,
  maritalStatuses,
  unattachedReasons,
  showUnattached,
  submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  values: PersonValues;
  people: PersonOption[];
  statuses: ValueOption[];
  maritalStatuses: ValueOption[];
  unattachedReasons: ValueOption[];
  showUnattached: boolean;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const err = state?.fieldErrors ?? {};
  const local = (e164: string | null) => (e164 ? e164.replace(/^\+225/, "") : "");

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {values.id && <input type="hidden" name="person_id" value={values.id} />}

      <Section title="Identité">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Nom" name="last_name" defaultValue={values.last_name} error={err.last_name} />
          <TextField label="Prénom(s)" name="first_name" defaultValue={values.first_name} error={err.first_name} />
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Sexe</legend>
          <div className="flex gap-3">
            {[
              ["M", "Homme"],
              ["F", "Femme"],
            ].map(([value, label]) => (
              <label
                key={value}
                className="flex min-h-12 flex-1 cursor-pointer items-center gap-2 rounded-2xl border-2 border-line bg-surface px-4 has-checked:border-royal has-checked:bg-royal/5"
              >
                <input type="radio" name="sex" value={value} defaultChecked={values.sex === value} className="size-5 accent-royal" />
                <span className="font-semibold">{label}</span>
              </label>
            ))}
          </div>
          {err.sex && <p className="mt-1 text-sm font-medium text-alert-text">{err.sex}</p>}
        </fieldset>
        <TextField label="Date de naissance" name="birth_date" type="date" defaultValue={values.birth_date ?? ""} error={err.birth_date} />
        <Select label="Situation familiale" name="marital_status" options={maritalStatuses} defaultValue={values.marital_status} empty="Non renseignée" />
      </Section>

      <Section title="Contacts">
        <TextField label="Téléphone" name="phone" type="tel" inputMode="tel" prefix="+225" defaultValue={local(values.phone)} error={err.phone} />
        <TextField label="WhatsApp (si différent)" name="whatsapp" type="tel" inputMode="tel" prefix="+225" defaultValue={local(values.whatsapp)} error={err.whatsapp} />
        <TextField label="Téléphone d'un proche" name="relative_phone" type="tel" inputMode="tel" prefix="+225" defaultValue={local(values.relative_phone)} error={err.relative_phone} />
      </Section>

      <Section title="Domicile">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Commune" name="commune" defaultValue={values.commune ?? ""} />
          <TextField label="Quartier" name="district" defaultValue={values.district ?? ""} />
        </div>
        <TextField label="Repère" name="landmark" placeholder="Ex. derrière la pharmacie du carrefour" defaultValue={values.landmark ?? ""} />
      </Section>

      <Section title="Vie dans l'église">
        <Select label="Statut" name="status" options={statuses} defaultValue={values.status} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Arrivé(e) le" name="arrived_at" type="date" defaultValue={values.arrived_at ?? ""} error={err.arrived_at} />
          <TextField label="Baptisé(e) le" name="baptized_at" type="date" defaultValue={values.baptized_at ?? ""} error={err.baptized_at} />
        </div>
        <PersonPicker name="brought_by" label="Amené(e) par (facultatif)" people={people} defaultId={values.brought_by} />
        {err.brought_by && <p className="-mt-2 text-sm font-medium text-alert-text">{err.brought_by}</p>}
        {showUnattached && (
          <Select label="Sans famille : pourquoi ?" name="unattached_reason" options={unattachedReasons} defaultValue={values.unattached_reason} empty="Non précisé" />
        )}
        <label className="flex min-h-12 cursor-pointer items-start gap-3">
          <input type="checkbox" name="weekday_exempt" defaultChecked={values.weekday_exempt} className="mt-0.5 size-5 shrink-0 accent-royal" />
          <span>
            <span className="block font-semibold">Dispensé(e) des cultes de semaine</span>
            <span className="block text-sm text-muted">Seules ses absences du dimanche déclencheront des alertes.</span>
          </span>
        </label>
      </Section>

      <FormFeedback state={state} />
      <Button type="submit" fullWidth loading={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
