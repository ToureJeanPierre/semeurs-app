import { declareAbsence } from "@/app/(app)/mon-espace/actions";
import type { ValueOption } from "@/components/people/PersonFields";
import { TextField } from "@/components/ui/TextField";
import { ActionForm } from "./ActionForm";

/** Déclarer une absence justifiée (pour soi, ou pour un fidèle qu'on suit). */
export function AbsenceForm({ reasons, personId }: { reasons: ValueOption[]; personId?: string }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <ActionForm action={declareAbsence} hidden={personId ? { person_id: personId } : {}} submitLabel="Déclarer l'absence">
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Du" name="starts_on" type="date" defaultValue={today} />
        <TextField label="Au" name="ends_on" type="date" defaultValue={today} />
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Motif</span>
        <select name="reason" defaultValue="travel" className="min-h-13 rounded-2xl border-2 border-line bg-surface px-3 text-base focus:border-ink/40">
          {reasons.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <TextField label="Précision (facultatif)" name="note" />
    </ActionForm>
  );
}
