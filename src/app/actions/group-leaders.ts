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

/** Le responsable demande qu'un membre quitte le groupe ; l'administration décidera. */
export async function requestGroupExit(_prev: FormState, formData: FormData): Promise<FormState> {
  const groupId = String(formData.get("group_id") ?? "");
  const personId = optional(formData.get("person_id"));
  const choice = String(formData.get("reason") ?? "").trim();
  const reason = choice === "__other" ? String(formData.get("reason_other") ?? "").trim() : choice;
  if (!personId) return { fieldErrors: { person_id: "Choisissez le membre." } };
  if (!choice) return { fieldErrors: { reason: "Choisissez le motif." } };
  if (reason.length < 3) return { fieldErrors: { reason_other: "Écrivez le motif." } };
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("my_access");
  const { error } = await supabase.from("group_exit_requests").insert({
    group_id: groupId,
    person_id: personId,
    reason,
    requested_by: (me as { person_id?: string } | null)?.person_id ?? null,
  });
  if (error) return { error: error.code === "23505" ? "Une demande est déjà en attente pour cette personne." : explain(error) };
  revalidatePath("/famille");
  revalidatePath(`/mes-groupes/${groupId}`);
  return { success: "Demande envoyée : l'administration va la traiter. Le membre reste dans le groupe en attendant." };
}

/** L'administration ou le pasteur accepte (la personne quitte le groupe) ou refuse la demande. */
export async function decideGroupExit(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const approve = formData.get("approve") === "1";
  const { error } = await supabase.rpc("decide_group_exit", {
    p_request: String(formData.get("request_id") ?? ""),
    p_approve: approve,
    p_note: optional(formData.get("note")),
  });
  if (error) return { error: explain(error) };
  revalidatePath("/administration/demandes");
  revalidatePath("/administration");
  return { success: approve ? "Retrait accepté : la personne a quitté le groupe." : "Demande refusée : la personne reste dans le groupe." };
}
