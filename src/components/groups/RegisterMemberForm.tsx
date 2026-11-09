import { addPersonToGroup } from "@/app/(app)/fideles/actions";
import { ContactPickerButton } from "@/components/people/ContactPickerButton";
import { ActionForm } from "@/components/people/ActionForm";
import { FormCard } from "@/components/ui/FormCard";
import { TextField } from "@/components/ui/TextField";

/**
 * Inscrire une personne dans son groupe (responsable d'équipe, de cellule, de Jeunesse…).
 * Si le numéro est déjà connu, la personne existante est rattachée au groupe : pas de doublon.
 */
export function RegisterMemberForm({ groupId }: { groupId: string }) {
  return (
    <FormCard title="Inscrire un membre" subtitle="Un numéro déjà connu rattache la personne existante." icon="users-round" tone="green">
      <ActionForm action={addPersonToGroup} hidden={{ group_id: groupId }} submitLabel="Inscrire dans le groupe" variant="primary">
        <ContactPickerButton />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Nom" name="last_name" autoComplete="off" />
          <TextField label="Prénom(s)" name="first_name" autoComplete="off" />
        </div>
        <div className="flex gap-3">
          {[
            ["M", "Homme"],
            ["F", "Femme"],
          ].map(([value, label]) => (
            <label
              key={value}
              className="flex min-h-12 flex-1 cursor-pointer items-center gap-2 rounded-2xl border-2 border-[#c9daf6] bg-[#f4f8ff] px-4 has-checked:border-royal has-checked:bg-royal/5"
            >
              <input type="radio" name="sex" value={value} className="size-5 accent-royal" />
              <span className="font-semibold">{label}</span>
            </label>
          ))}
        </div>
        <TextField label="Téléphone (facultatif)" name="phone" type="tel" inputMode="tel" prefix="+225" />
      </ActionForm>
    </FormCard>
  );
}
