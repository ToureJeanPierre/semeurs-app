import { declarePayment } from "@/app/(app)/cotisations/actions";
import { ActionForm } from "@/components/people/ActionForm";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { formatMonth } from "@/lib/format";

/** « J'ai payé » : le fidèle déclare son versement (référence Mobile Money), la trésorière valide. */
export function DeclareForm({
  headingId,
  methods,
  suggested,
  periods,
}: {
  headingId: string;
  methods: { value: string; label: string }[];
  suggested?: number | null;
  periods?: string[];
}) {
  return (
    <ActionForm action={declarePayment} hidden={{ heading_id: headingId }} submitLabel="Déclarer mon versement" className="flex flex-col gap-3 pb-3">
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Montant (FCFA)" name="amount" inputMode="numeric" defaultValue={suggested ? String(suggested) : ""} required />
        <SelectField label="Payé par" name="method" options={methods} defaultValue="orange_money" />
      </div>
      <TextField label="Référence de la transaction" name="reference" hint="Le code reçu par SMS après le paiement (inutile pour les espèces)." />
      {periods && periods.length > 0 && (
        <SelectField label="Pour le mois de" name="period" options={periods.map((p) => ({ value: p, label: formatMonth(`${p}-01`) }))} />
      )}
    </ActionForm>
  );
}
