"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/app/actions/auth";
import { explain, optional } from "@/lib/action-helpers";
import { createClient } from "@/lib/supabase/server";

/** Lien inverse enregistré en même temps (si on a aussi le droit sur l'autre fiche). */
const INVERSE: Record<string, string> = { parent: "child", child: "parent", spouse: "spouse", guardian: "child" };

/** Ajoute un lien (parent, enfant, conjoint, tuteur) entre deux fiches. */
export async function addRelation(_prev: FormState, formData: FormData): Promise<FormState> {
  const personId = String(formData.get("person_id") ?? "");
  const relatedId = optional(formData.get("related_id"));
  const relation = String(formData.get("relation") ?? "");
  if (!relatedId) return { fieldErrors: { related_id: "Choisissez la personne." } };
  if (relatedId === personId) return { fieldErrors: { related_id: "Choisissez une autre personne." } };
  const supabase = await createClient();
  const { error } = await supabase
    .from("person_relations")
    .upsert({ person_id: personId, related_id: relatedId, relation, can_pickup: formData.get("can_pickup") === "on" }, { onConflict: "person_id,related_id" });
  if (error) return { error: explain(error) };
  const inverse = INVERSE[relation];
  if (inverse) {
    await supabase.from("person_relations").upsert({ person_id: relatedId, related_id: personId, relation: inverse }, { onConflict: "person_id,related_id", ignoreDuplicates: true });
  }
  revalidatePath(`/fideles/${personId}`);
  return { success: "Lien enregistré." };
}

export async function removeRelation(formData: FormData): Promise<void> {
  const supabase = await createClient();
  await supabase.from("person_relations").delete().eq("id", String(formData.get("relation_id") ?? ""));
  revalidatePath(`/fideles/${String(formData.get("person_id") ?? "")}`);
}
