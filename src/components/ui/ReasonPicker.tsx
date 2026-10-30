"use client";

import { useState } from "react";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";

export const OTHER_REASON = "__other";

/**
 * Motif à choisir dans une liste administrable ; « Autre » ouvre un champ pour l'écrire.
 * Envoie `reason` (le libellé choisi) ou `reason_other` (le texte libre).
 */
export function ReasonPicker({ label, options }: { label: string; options: { value: string; label: string }[] }) {
  const [choice, setChoice] = useState("");
  return (
    <>
      <SelectField
        label={label}
        name="reason"
        value={choice}
        onChange={(e) => setChoice(e.target.value)}
        options={[{ value: "", label: "Choisir…" }, ...options.map((o) => ({ value: o.label, label: o.label })), { value: OTHER_REASON, label: "Autre motif…" }]}
      />
      {choice === OTHER_REASON && <TextField label="Écrivez le motif" name="reason_other" required autoFocus />}
    </>
  );
}
