import type { Metadata } from "next";
import { PageTitle } from "@/components/admin/AdminCard";
import { PersonPicker } from "@/components/admin/PersonPicker";
import { ActionForm } from "@/components/people/ActionForm";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { requirePermission } from "@/lib/access";
import { loadPeopleOptions } from "@/lib/admin";
import { loadCashLabels } from "@/lib/cash-server";
import { todayIso } from "@/lib/format";
import { recordOperation } from "../actions";

export const metadata: Metadata = { title: "Saisie de caisse" };

/** Recette (don, dîme, collecte…) ou dépense avec justificatif photographié. */
export default async function CashEntryPage({ searchParams }: PageProps<"/caisse/saisie">) {
  await requirePermission("cash.manage");
  const out = (await searchParams).sens === "out";
  const [labels, people] = await Promise.all([loadCashLabels(), loadPeopleOptions()]);
  const categories = out ? labels.expense : labels.income.filter((c) => c.value !== "pledge" && c.value !== "offering");

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle
        title={out ? "Dépense" : "Recette"}
        intro={out ? "Avec la photo du justificatif. Au-delà du plafond, le pasteur approuve." : "Don, dîme, action de grâce, collecte… Les offrandes se comptent par coupures."}
      />
      <Card className="shadow-card">
        <ActionForm action={recordOperation} hidden={{ direction: out ? "out" : "in" }} submitLabel="Enregistrer" variant="primary">
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Montant (FCFA)" name="amount" inputMode="numeric" required />
            <TextField label="Date" name="op_date" type="date" defaultValue={todayIso()} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Catégorie" name="category" options={categories} />
            <SelectField label="Compte" name="account_id" options={labels.accounts.map((a) => ({ value: a.id, label: a.name }))} />
          </div>
          <TextField label="Libellé" name="label" placeholder={out ? "Facture CIE d'octobre" : "Don de la famille …"} />
          {!out && (
            <>
              <PersonPicker name="person_id" label="Donateur (facultatif ; obligatoire pour une dîme nominative)" people={people} />
              <label className="flex min-h-11 items-start gap-3 text-sm">
                <input type="checkbox" name="anonymous" className="mt-1 size-5 accent-royal" />
                <span>Dîme anonyme (le nom ne figurera pas dans le suivi des dîmes)</span>
              </label>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Moyen" name="method" options={labels.methods} />
            <TextField label="Référence" name="reference" placeholder="Mobile Money, chèque…" />
          </div>
          {out && (
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                Justificatif (photo)
                <input type="file" name="attachment" accept="image/*,application/pdf" capture="environment" className="min-h-12 rounded-2xl border-2 border-dashed border-line bg-cloud p-3 text-sm font-normal" />
              </label>
              <label className="flex min-h-11 items-start gap-3 text-sm">
                <input type="checkbox" name="no_attachment" className="mt-1 size-5 accent-royal" />
                <span>Pas de justificatif (expliquez dans le libellé)</span>
              </label>
            </div>
          )}
        </ActionForm>
      </Card>
    </div>
  );
}
