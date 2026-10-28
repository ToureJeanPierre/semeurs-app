"use client";

import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";

/** Petit bouton d'un formulaire simple (sans message de retour), désactivé pendant l'envoi. */
export function SubmitButton({ className = "", children, disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" {...props} disabled={pending || disabled} aria-busy={pending} className={`disabled:opacity-60 ${className}`}>
      {children}
    </button>
  );
}
