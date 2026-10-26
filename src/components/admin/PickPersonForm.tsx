"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { FormFeedback } from "./FormFeedback";
import { PersonPicker, type PersonOption } from "./PersonPicker";

/** Petit formulaire « choisir une personne puis valider » (responsable, membre, rôle…). */
export function PickPersonForm({
  action,
  hidden,
  label,
  people,
  defaultId,
  submitLabel,
  children,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  hidden: Record<string, string>;
  label: string;
  people: PersonOption[];
  defaultId?: string | null;
  submitLabel: string;
  children?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <PersonPicker name="person_id" label={label} people={people} defaultId={defaultId} />
      {children}
      <FormFeedback state={state} />
      <Button type="submit" variant="secondary" loading={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
