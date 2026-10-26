"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import type { Capability, GroupFunction } from "@/lib/admin";
import { FormFeedback } from "./FormFeedback";
import { PersonPicker, type PersonOption } from "./PersonPicker";

const PALETTE = ["#1546B8", "#0B2A6F", "#3BA7F0", "#E9A90F", "#F08A1C", "#2E9D62", "#8E44AD", "#D2342A"];

/**
 * Formulaire d'un groupe : nom, couleur, capacités à cocher, et (à la création)
 * les responsables choisis dans la liste des membres.
 */
export function GroupForm({
  action,
  typeId,
  groupId,
  typeName,
  defaults,
  capabilities,
  checkedCapabilities,
  functions,
  people,
  submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  typeId?: string;
  groupId?: string;
  typeName: string;
  defaults: { name: string; description: string; color: string };
  capabilities: Capability[];
  checkedCapabilities: string[];
  functions?: GroupFunction[];
  people?: PersonOption[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {typeId && <input type="hidden" name="type_id" value={typeId} />}
      {groupId && <input type="hidden" name="group_id" value={groupId} />}

      <TextField
        label={`Nom (${typeName.toLowerCase()})`}
        name="name"
        defaultValue={defaults.name}
        required
        error={state?.fieldErrors?.name}
      />
      <TextField label="Description (facultatif)" name="description" defaultValue={defaults.description} />

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Couleur</legend>
        <div className="flex flex-wrap gap-2">
          {PALETTE.map((color) => (
            <label key={color} className="relative grid size-11 cursor-pointer place-items-center">
              <input
                type="radio"
                name="color"
                value={color}
                defaultChecked={color.toLowerCase() === defaults.color.toLowerCase()}
                className="peer sr-only"
              />
              <span className="size-10 rounded-full ring-offset-2 peer-checked:ring-3 peer-checked:ring-ink peer-focus-visible:ring-3 peer-focus-visible:ring-sky" style={{ background: color }} />
              <Check aria-hidden className="absolute hidden size-5 text-white peer-checked:block" />
              <span className="sr-only">{color}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-sm font-semibold">Capacités du groupe</legend>
        <p className="mb-2 text-sm text-muted">Cochez ce dont le groupe a besoin. Tout fonctionne aussitôt.</p>
        <div className="flex flex-col gap-2">
          {capabilities.map((c) => (
            <label key={c.code} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl bg-surface p-3 shadow-card">
              <input
                type="checkbox"
                name="capabilities"
                value={c.code}
                defaultChecked={checkedCapabilities.includes(c.code)}
                className="mt-0.5 size-5 shrink-0 accent-royal"
              />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 font-semibold">
                  {c.label}
                  {!c.available && (
                    <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs font-semibold text-night">
                      Bientôt
                    </span>
                  )}
                </span>
                <span className="block text-sm text-muted">{c.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {functions && people && functions.length > 0 && (
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-1 text-sm font-semibold">Bureau (facultatif)</legend>
          {functions.map((f) => (
            <PersonPicker key={f.id} name={`function:${f.id}`} label={f.label} people={people} />
          ))}
        </fieldset>
      )}

      <FormFeedback state={state} />
      <Button type="submit" fullWidth loading={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
