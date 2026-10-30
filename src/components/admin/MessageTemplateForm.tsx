"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { FormFeedback } from "./FormFeedback";

/** Un modèle de message ({prénom} remplacé à l'envoi), modifiable par l'administrateur. */
export function MessageTemplateForm({
  action,
  code,
  label,
  body,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  code: string;
  label: string;
  body: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-2" noValidate>
      <input type="hidden" name="code" value={code} />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">{label}</span>
        <textarea
          name="body"
          rows={4}
          defaultValue={body}
          className="rounded-2xl border-2 border-[#c9daf6] bg-[#f4f8ff] p-3 text-base focus:border-royal focus:bg-white focus:ring-4 focus:ring-royal/10"
        />
      </label>
      {state?.fieldErrors?.body && <p className="text-sm font-medium text-alert-text">{state.fieldErrors.body}</p>}
      <FormFeedback state={state} />
      <Button type="submit" variant="secondary" loading={pending}>
        Enregistrer ce message
      </Button>
    </form>
  );
}
