"use client";

import { useActionState, type ReactNode } from "react";
import type { FormState } from "@/app/actions/auth";
import { FormFeedback } from "@/components/admin/FormFeedback";
import { Button } from "@/components/ui/Button";

/** Formulaire générique : champs libres + bouton + message de résultat. */
export function ActionForm({
  action,
  hidden = {},
  submitLabel,
  variant = "secondary",
  children,
  className = "flex flex-col gap-3",
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  hidden?: Record<string, string>;
  submitLabel: string;
  variant?: "primary" | "secondary" | "gold" | "ghost";
  children?: ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className} noValidate>
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      <FormFeedback state={state} />
      <Button type="submit" variant={variant} loading={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
