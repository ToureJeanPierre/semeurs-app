"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/app/actions/auth";
import { explain, optional } from "@/lib/action-helpers";
import { createClient } from "@/lib/supabase/server";

/** Un responsable confie (ou retire) une fonction d'aide dans son groupe. */
export async function setGroupHelper(_prev: FormState, formData: FormData): Promise<FormState> {
  const groupId = String(formData.get("group_id") ?? "");
  const remove = formData.get("remove") === "1";
  const person = remove ? null : optional(formData.get("person_id"));
  if (!remove && !person) return { fieldErrors: { person_id: "Choisissez un membre." } };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_group_function", {
    p_group: groupId,
    p_function: String(formData.get("function_id") ?? ""),
    p_person: person,
  });
  if (error) return { error: explain(error) };
  revalidatePath("/famille");
  revalidatePath(`/mes-groupes/${groupId}`);
  return { success: remove ? "Fonction retirée." : "C'est fait : cette personne vous aide désormais." };
}
