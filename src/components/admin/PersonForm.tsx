"use client";

import { useActionState, useEffect, useRef } from "react";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { FormFeedback } from "./FormFeedback";

/** Ajout rapide au registre (la fiche complète arrive à l'étape 2). */
export function PersonForm({ action }: { action: (state: FormState, formData: FormData) => Promise<FormState> }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Nom" name="last_name" autoComplete="off" required error={state?.fieldErrors?.last_name} />
        <TextField label="Prénom(s)" name="first_name" autoComplete="off" required error={state?.fieldErrors?.first_name} />
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Sexe</legend>
        <div className="flex gap-3">
          {[
            ["M", "Homme"],
            ["F", "Femme"],
          ].map(([value, label]) => (
            <label key={value} className="flex min-h-12 flex-1 cursor-pointer items-center gap-2 rounded-2xl border-2 border-line bg-surface px-4 has-checked:border-royal has-checked:bg-royal/5">
              <input type="radio" name="sex" value={value} className="size-5 accent-royal" />
              <span className="font-semibold">{label}</span>
            </label>
          ))}
        </div>
        {state?.fieldErrors?.sex && <p className="mt-1 text-sm font-medium text-alert-text">{state.fieldErrors.sex}</p>}
      </fieldset>
      <TextField
        label="Téléphone (facultatif)"
        name="phone"
        type="tel"
        inputMode="tel"
        prefix="+225"
        placeholder="07 08 31 04 33"
        error={state?.fieldErrors?.phone}
      />
      <FormFeedback state={state} />
      <Button type="submit" fullWidth loading={pending}>
        Ajouter au registre
      </Button>
    </form>
  );
}
