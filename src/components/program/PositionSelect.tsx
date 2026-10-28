"use client";

import { useRef } from "react";

/** Choix du titulaire d'un poste : l'enregistrement part dès qu'on change la valeur. */
export function PositionSelect({
  action,
  positionId,
  label,
  value,
  options,
  warning,
}: {
  action: (formData: FormData) => Promise<void>;
  positionId: string;
  label: string;
  value: string | null;
  options: { id: string; name: string }[];
  warning?: string | null;
}) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={action} className="flex flex-col gap-1">
      <input type="hidden" name="position_id" value={positionId} />
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted">{label}</span>
        <select
          name="person_id"
          defaultValue={value ?? ""}
          onChange={() => form.current?.requestSubmit()}
          className={`min-h-11 max-w-[60%] rounded-xl border-2 bg-surface px-2 text-right font-semibold ${
            value ? "border-line" : "border-alert-ring text-alert-text"
          }`}
        >
          <option value="">— À pourvoir —</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      {warning && <span className="text-right text-xs font-semibold text-warn-text">{warning}</span>}
    </form>
  );
}
