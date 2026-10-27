import { addFollowUp } from "@/app/(app)/fideles/actions";
import { ActionForm } from "@/components/people/ActionForm";
import type { ValueOption } from "@/components/people/PersonFields";
import { TextField } from "@/components/ui/TextField";

function Select({ label, name, options }: { label: string; name: string; options: ValueOption[] }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">{label}</span>
      <select name={name} defaultValue={options[0]?.value} className="min-h-13 rounded-2xl border-2 border-line bg-surface px-3 text-base focus:border-ink/40">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** « Noter un contact » : moyen, résultat, note (éventuellement sensible), prochaine action. */
export function FollowUpForm({ personId, channels, results }: { personId: string; channels: ValueOption[]; results: ValueOption[] }) {
  return (
    <ActionForm action={addFollowUp} hidden={{ person_id: personId }} submitLabel="Enregistrer le contact" variant="primary">
      <div className="grid grid-cols-2 gap-3">
        <Select label="Moyen" name="channel" options={channels} />
        <Select label="Résultat" name="result" options={results} />
      </div>
      <TextField label="Note (facultatif)" name="note" />
      <label className="flex min-h-12 cursor-pointer items-start gap-3">
        <input type="checkbox" name="confidential" className="mt-0.5 size-5 shrink-0 accent-royal" />
        <span>
          <span className="block font-semibold">Note sensible</span>
          <span className="block text-sm text-muted">Visible seulement de vous, du père de famille et du pasteur.</span>
        </span>
      </label>
      <TextField label="Prochaine action le (facultatif)" name="next_action_on" type="date" />
    </ActionForm>
  );
}
