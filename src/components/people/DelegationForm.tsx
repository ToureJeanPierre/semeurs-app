"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";
import { FormFeedback } from "@/components/admin/FormFeedback";
import { PersonPicker, type PersonOption } from "@/components/admin/PersonPicker";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

/** Confier un sous-groupe de la famille à un délégué (docs/01 §6.3). */
export function DelegationForm({
  action,
  familyId,
  members,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  familyId: string;
  members: PersonOption[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="family_id" value={familyId} />
      <PersonPicker name="person_id" label="Délégué (un membre de la famille)" people={members} />
      <TextField label="Nom du sous-groupe (facultatif)" name="label" placeholder="Ex. Niangon, Toits rouges" />
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Fidèles confiés</legend>
        <div className="flex flex-col gap-1">
          {members.map((m) => (
            <label key={m.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-royal/5">
              <input type="checkbox" name="members" value={m.id} className="size-5 shrink-0 accent-royal" />
              <span className="min-w-0">
                <span className="block font-semibold">{m.name}</span>
                {m.detail && <span className="block text-xs text-muted">{m.detail}</span>}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <FormFeedback state={state} />
      <Button type="submit" variant="secondary" loading={pending}>
        Confier ces fidèles
      </Button>
    </form>
  );
}
