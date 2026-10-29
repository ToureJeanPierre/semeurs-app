"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/app/actions/auth";
import { explain, optional } from "@/lib/action-helpers";
import { createClient } from "@/lib/supabase/server";

/** Personnes concernées, dans l'ordre attendu par la base : baptisé(e) ; époux, épouse ; enfant, parents. */
const ROLES: Record<string, { field: string; required: boolean; label: string }[]> = {
  baptism: [{ field: "p1", required: true, label: "la personne baptisée" }],
  wedding: [
    { field: "p1", required: true, label: "l'époux" },
    { field: "p2", required: true, label: "l'épouse" },
  ],
  child_presentation: [
    { field: "p1", required: true, label: "l'enfant" },
    { field: "p2", required: false, label: "" },
    { field: "p3", required: false, label: "" },
  ],
};

/** Enregistre un acte ; la base attribue le numéro de certificat et met les fiches à jour. */
export async function createAct(_prev: FormState, formData: FormData): Promise<FormState> {
  const kind = String(formData.get("kind") ?? "");
  const roles = ROLES[kind];
  if (!roles) return { error: "Type d'acte inconnu." };
  const ids: string[] = [];
  for (const r of roles) {
    const value = optional(formData.get(r.field));
    if (!value && r.required) return { fieldErrors: { [r.field]: `Choisissez ${r.label}.` } };
    if (value) ids.push(value);
  }
  if (new Set(ids).size !== ids.length) return { error: "La même personne est choisie deux fois." };
  const date = String(formData.get("act_date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { fieldErrors: { act_date: "Date ?" } };
  const officiantId = optional(formData.get("officiant_id"));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("acts")
    .insert({
      kind,
      act_date: date,
      place: optional(formData.get("place")),
      officiant_id: officiantId,
      officiant_name: officiantId ? null : optional(formData.get("officiant_name")),
      person_ids: ids,
      witnesses: optional(formData.get("witnesses")),
      notes: optional(formData.get("notes")),
    })
    .select("id")
    .single();
  if (error) return { error: explain(error) };
  revalidatePath("/actes");
  redirect(`/actes/${data.id}`);
}
