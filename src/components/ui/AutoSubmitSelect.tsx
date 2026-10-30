"use client";

import { useRef } from "react";

/** Liste déroulante qui enregistre dès qu'on change la valeur (champs cachés + une valeur). */
export function AutoSubmitSelect({
  action,
  hidden,
  name,
  value,
  options,
  ariaLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  hidden: Record<string, string>;
  name: string;
  value: string;
  options: { value: string; label: string }[];
  ariaLabel: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={action}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <select
        name={name}
        defaultValue={value}
        aria-label={ariaLabel}
        onChange={() => form.current?.requestSubmit()}
        className="min-h-11 rounded-xl border-2 border-[#c9daf6] bg-[#f4f8ff] px-2 text-sm font-semibold"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </form>
  );
}
