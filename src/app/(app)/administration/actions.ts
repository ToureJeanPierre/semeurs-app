"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth/session";
import { parseIvorianPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

/**
 * Actions de l'administration. Chaque écriture passe par le client Supabase de
 * la personne connectée : les règles RLS décident, ce code ne fait que traduire
 * les refus en messages clairs.
 */

function explain(error: { code?: string; message: string } | null): string | undefined {
  if (!error) return undefined;
  if (error.code === "42501") return "Vous n'avez pas le droit de faire cette modification.";
  if (error.code === "23505") return "Cet élément existe déjà.";
  if (error.code === "P0001") return error.message; // message métier écrit en français dans la base
  return "L'enregistrement a échoué. Réessayez dans un instant.";
}

function fieldErrors(issues: z.core.$ZodIssue[]): FormState {
  const errors: Record<string, string> = {};
  for (const issue of issues) errors[String(issue.path[0])] = issue.message;
  return { fieldErrors: errors };
}

const uuid = z.uuid("Choix invalide.");
const optionalText = z
  .string()
  .trim()
  .transform((v) => v || null)
  .nullable();

// ---------------------------------------------------------------------------
// Groupes
// ---------------------------------------------------------------------------
const groupSchema = z.object({
  name: z.string().trim().min(1, "Donnez un nom."),
  description: optionalText,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide."),
});

/** Crée un groupe (famille, équipe, cellule…) avec ses capacités et son bureau. */
export async function createGroup(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = groupSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    color: formData.get("color"),
  });
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const typeId = uuid.safeParse(formData.get("type_id"));
  if (!typeId.success) return { error: "Type de groupe inconnu." };

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: group, error } = await supabase
    .from("groups")
    .insert({ ...parsed.data, type_id: typeId.data, created_by: user?.id })
    .select("id")
    .single();
  if (error || !group) return { error: explain(error) };

  const capabilities = formData.getAll("capabilities").map(String);
  if (capabilities.length > 0) {
    const { error: capError } = await supabase
      .from("group_capabilities")
      .insert(capabilities.map((code) => ({ group_id: group.id, capability_code: code })));
    if (capError) return { error: explain(capError) };
  }

  // Bureau : champs « function:<id> » = personne choisie dans la liste des membres.
  const leaders = [...formData.entries()]
    .filter(([key, value]) => key.startsWith("function:") && value)
    .map(([key, value]) => ({ function_id: key.slice("function:".length), person_id: String(value) }));
  for (const leader of leaders) {
    const message = await assignFunction(group.id, leader.function_id, leader.person_id);
    if (message) return { error: message };
  }

  revalidatePath("/administration", "layout");
  redirect(`/administration/groupes/${group.id}`);
}

export async function updateGroup(_prev: FormState, formData: FormData): Promise<FormState> {
  const groupId = uuid.safeParse(formData.get("group_id"));
  if (!groupId.success) return { error: "Groupe inconnu." };
  const parsed = groupSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    color: formData.get("color"),
  });
  if (!parsed.success) return fieldErrors(parsed.error.issues);

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("groups")
    .update(parsed.data)
    .eq("id", groupId.data)
    .select("id");
  if (error) return { error: explain(error) };
  if (!updated?.length) return { error: "Vous n'avez pas le droit de modifier ce groupe." };

  // Capacités : on aligne la base sur les cases cochées.
  const wanted = new Set(formData.getAll("capabilities").map(String));
  const { data: current } = await supabase
    .from("group_capabilities")
    .select("capability_code")
    .eq("group_id", groupId.data);
  const existing = new Set((current ?? []).map((c) => c.capability_code));
  const toAdd = [...wanted].filter((c) => !existing.has(c));
  const toRemove = [...existing].filter((c) => !wanted.has(c));
  if (toAdd.length) {
    const { error: addError } = await supabase
      .from("group_capabilities")
      .insert(toAdd.map((code) => ({ group_id: groupId.data, capability_code: code })));
    if (addError) return { error: explain(addError) };
  }
  if (toRemove.length) {
    const { error: removeError } = await supabase
      .from("group_capabilities")
      .delete()
      .eq("group_id", groupId.data)
      .in("capability_code", toRemove);
    if (removeError) return { error: explain(removeError) };
  }

  revalidatePath(`/administration/groupes/${groupId.data}`);
  revalidatePath("/administration/groupes");
  return { success: "Modifications enregistrées." };
}

/**
 * Confie une fonction du bureau (père de famille, responsable…) à une personne.
 * L'ancien titulaire reste membre du groupe, sans la fonction.
 */
async function assignFunction(groupId: string, functionId: string, personId: string): Promise<string | undefined> {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { error: clearError } = await supabase
    .from("group_memberships")
    .update({ function_id: null })
    .eq("group_id", groupId)
    .eq("function_id", functionId)
    .is("end_date", null);
  if (clearError) return explain(clearError);

  const { data: existing } = await supabase
    .from("group_memberships")
    .select("id")
    .eq("group_id", groupId)
    .eq("person_id", personId)
    .is("end_date", null)
    .maybeSingle();

  const { error } = existing
    ? await supabase.from("group_memberships").update({ function_id: functionId }).eq("id", existing.id)
    : await supabase
        .from("group_memberships")
        .insert({ group_id: groupId, person_id: personId, function_id: functionId, created_by: user?.id });
  return explain(error);
}

export async function setGroupFunction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ids = z
    .object({ group_id: uuid, function_id: uuid, person_id: uuid })
    .safeParse(Object.fromEntries(formData));
  if (!ids.success) return { error: "Choisissez une personne dans la liste." };
  const message = await assignFunction(ids.data.group_id, ids.data.function_id, ids.data.person_id);
  if (message) return { error: message };
  revalidatePath(`/administration/groupes/${ids.data.group_id}`);
  return { success: "Responsable enregistré." };
}

export async function addGroupMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const ids = z.object({ group_id: uuid, person_id: uuid }).safeParse(Object.fromEntries(formData));
  if (!ids.success) return { error: "Choisissez une personne dans la liste." };
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("group_memberships")
    .insert({ ...ids.data, created_by: user?.id });
  if (error) return { error: explain(error) };
  revalidatePath(`/administration/groupes/${ids.data.group_id}`);
  return { success: "Membre ajouté." };
}

/** Retire une personne d'un groupe : l'appartenance est close (historique conservé), jamais supprimée. */
export async function endGroupMembership(formData: FormData): Promise<void> {
  const ids = z.object({ membership_id: uuid, group_id: uuid }).safeParse(Object.fromEntries(formData));
  if (!ids.success) return;
  const supabase = await createClient();
  await supabase
    .from("group_memberships")
    .update({ end_date: new Date().toISOString().slice(0, 10), function_id: null })
    .eq("id", ids.data.membership_id);
  revalidatePath(`/administration/groupes/${ids.data.group_id}`);
}

// ---------------------------------------------------------------------------
// Personnes
// ---------------------------------------------------------------------------
const personSchema = z.object({
  first_name: z.string().trim().min(1, "Saisissez le prénom."),
  last_name: z.string().trim().min(1, "Saisissez le nom."),
  sex: z.enum(["F", "M"], "Choisissez Homme ou Femme."),
  phone: z.string().trim(),
});

export async function createPerson(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = personSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);

  let phone: string | null = null;
  if (parsed.data.phone) {
    const parsedPhone = parseIvorianPhone(parsed.data.phone);
    if (!parsedPhone) return { fieldErrors: { phone: "Numéro invalide : 10 chiffres, par exemple 07 08 31 04 33." } };
    phone = parsedPhone.e164;
  }

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("people").insert({
    first_name: parsed.data.first_name,
    last_name: parsed.data.last_name,
    sex: parsed.data.sex,
    phone,
    created_by: user?.id,
  });
  if (error) return { error: explain(error) };
  revalidatePath("/administration", "layout");
  return { success: `${parsed.data.first_name} ${parsed.data.last_name} est ajouté(e) au registre.` };
}

// ---------------------------------------------------------------------------
// Rôles
// ---------------------------------------------------------------------------
export async function assignRole(_prev: FormState, formData: FormData): Promise<FormState> {
  const ids = z.object({ person_id: uuid, role_id: uuid }).safeParse(Object.fromEntries(formData));
  if (!ids.success) return { error: "Choisissez une personne et un rôle." };
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("role_assignments")
    .insert({ ...ids.data, scope_type: "church", created_by: user?.id });
  if (error) return { error: explain(error) };
  revalidatePath("/administration/roles");
  return { success: "Rôle attribué." };
}

export async function endRoleAssignment(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("assignment_id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase
    .from("role_assignments")
    .update({ end_date: new Date().toISOString().slice(0, 10) })
    .eq("id", id.data);
  revalidatePath("/administration/roles");
}

// ---------------------------------------------------------------------------
// Paramètres
// ---------------------------------------------------------------------------
const thresholdsSchema = z
  .object({
    attention: z.coerce.number().int().min(1, "Au moins 1 jour.").max(365),
    urgent: z.coerce.number().int().min(1).max(365),
    critical: z.coerce.number().int().min(1).max(365),
    lost: z.coerce.number().int().min(1).max(365),
  })
  .refine((t) => t.attention < t.urgent && t.urgent < t.critical && t.critical < t.lost, {
    message: "Les seuils doivent aller croissant : Attention < Urgent < Critique < Perdu de vue.",
    path: ["lost"],
  });

export async function updateAlertThresholds(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = thresholdsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("settings")
    .update({ value: parsed.data })
    .eq("key", "alert_thresholds")
    .select("key");
  if (error) return { error: explain(error) };
  if (!data?.length) return { error: "Vous n'avez pas le droit de modifier les paramètres." };
  revalidatePath("/administration/parametres");
  return { success: "Seuils enregistrés." };
}
