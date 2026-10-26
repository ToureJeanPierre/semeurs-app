"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { FormFeedback } from "./FormFeedback";

const LEVELS = [
  ["attention", "Attention (pastille orange)"],
  ["urgent", "Urgent (voyant rouge)"],
  ["critical", "Critique (rouge + badge)"],
  ["lost", "Perdu de vue"],
] as const;

export function ThresholdsForm({
  action,
  values,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  values: Record<(typeof LEVELS)[number][0], number>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {LEVELS.map(([key, label]) => (
        <TextField
          key={key}
          label={`${label} : à partir de (jours)`}
          name={key}
          type="number"
          inputMode="numeric"
          min={1}
          max={365}
          defaultValue={values[key]}
          error={state?.fieldErrors?.[key]}
        />
      ))}
      <FormFeedback state={state} />
      <Button type="submit" fullWidth loading={pending}>
        Enregistrer les seuils
      </Button>
    </form>
  );
}
