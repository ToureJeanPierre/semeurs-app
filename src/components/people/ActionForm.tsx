"use client";

import { useActionState, type ReactNode } from "react";
import type { FormState } from "@/app/actions/auth";
import { FormFeedback } from "@/components/admin/FormFeedback";
import { Button } from "@/components/ui/Button";

type Counted = (NonNullable<FormState> & { round?: number }) | undefined;

/**
 * Formulaire générique : champs libres + bouton + message de résultat.
 * Après une réussite, les champs repartent de zéro (choix de personne compris),
 * pour enchaîner les saisies sans effacer à la main.
 */
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
  const [state, formAction, pending] = useActionState<Counted, FormData>(async (prev, formData) => {
    const result = await action(prev, formData);
    return result ? { ...result, round: (prev?.round ?? 0) + 1 } : result;
  }, undefined);
  return (
    <form action={formAction} className={className} noValidate>
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div key={state?.success ? state.round : "form"} className="contents">
        {children}
      </div>
      <FormFeedback state={state} />
      <Button type="submit" variant={variant} loading={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
