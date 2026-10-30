"use client";

import { useActionState, useState } from "react";
import { recordCount } from "@/app/(app)/caisse/actions";
import { FormFeedback } from "@/components/admin/FormFeedback";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";

/** Saisie par coupures avec total en direct. */
export function CountForm({
  denominations,
  accounts,
  categories,
  today,
}: {
  denominations: number[];
  accounts: { value: string; label: string }[];
  categories: { value: string; label: string }[];
  today: string;
}) {
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [state, action, pending] = useActionState(recordCount, undefined);
  const total = denominations.reduce((s, d) => s + d * Math.max(0, Math.floor(Number(counts[d]) || 0)), 0);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Date" name="op_date" type="date" defaultValue={today} />
        <SelectField label="Quoi" name="category" options={categories} />
      </div>
      <TextField label="Culte" name="service_label" placeholder="Culte d'actions de grâces" />
      <SelectField label="Compte" name="account_id" options={accounts} />
      <div className="grid grid-cols-2 gap-2">
        {denominations.map((d) => (
          <label key={d} className="flex items-center gap-2 rounded-xl bg-cloud px-3 py-1">
            <span className="w-16 text-right text-sm font-semibold">{d.toLocaleString("fr-FR")}</span>
            <span className="text-muted">×</span>
            <input
              name={`d_${d}`}
              inputMode="numeric"
              value={counts[d] ?? ""}
              onChange={(e) => setCounts((c) => ({ ...c, [d]: e.target.value.replace(/\D/g, "") }))}
              aria-label={`Nombre de ${d} FCFA`}
              className="min-h-11 w-full rounded-lg border-2 border-[#c9daf6] bg-[#f4f8ff] px-2 text-right text-base"
            />
          </label>
        ))}
      </div>
      <p className="rounded-2xl bg-royal p-3 text-center text-white">
        Total <span className="block font-display text-2xl font-bold">{total.toLocaleString("fr-FR")} FCFA</span>
      </p>
      <FormFeedback state={state} />
      <Button type="submit" loading={pending} disabled={total === 0}>
        Enregistrer le comptage
      </Button>
    </form>
  );
}
