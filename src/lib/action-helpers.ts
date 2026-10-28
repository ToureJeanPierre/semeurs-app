import type { z } from "zod";
import type { FormState } from "@/app/actions/auth";

/**
 * Traduit une erreur Supabase en message clair. La sécurité est dans la base (RLS) :
 * ce code ne fait que rendre lisibles ses refus.
 */
export function explain(error: { code?: string; message: string } | null): string | undefined {
  if (!error) return undefined;
  if (error.code === "42501") return error.message && !error.message.startsWith("new row") && !error.message.startsWith("permission denied")
    ? error.message
    : "Vous n'avez pas le droit de faire cette opération.";
  if (error.code === "23505") return "Cet élément existe déjà.";
  if (error.code === "P0001") return error.message; // message métier écrit en français dans la base
  return "L'enregistrement a échoué. Réessayez dans un instant.";
}

export function fieldErrors(issues: z.core.$ZodIssue[]): FormState {
  const errors: Record<string, string> = {};
  for (const issue of issues) errors[String(issue.path[0])] = issue.message;
  return { fieldErrors: errors };
}

/** Champ de formulaire facultatif : chaîne vide → null. */
export const optional = (value: FormDataEntryValue | null) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text === "" ? null : text;
};
