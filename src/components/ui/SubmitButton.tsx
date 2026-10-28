"use client";

import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";

/** Petit bouton d'un formulaire simple (sans message de retour), désactivé pendant l'envoi. */
export function SubmitButton({ className = "", children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={`disabled:opacity-60 ${className}`} {...props}>
      {children}
    </button>
  );
}
