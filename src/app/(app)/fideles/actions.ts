"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth/session";
import { generateStarterPassword } from "@/lib/password";
import { parseIvorianPhone, phoneToAuthEmail } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Actions sur les fiches, les familles et la délégation. Les écritures passent
 * par le client de la personne connectée (règles RLS). Seule la création d'un
 * compte de connexion utilise la clé secrète, après vérification explicite des droits.
 */

function explain(error: { code?: string; message: string } | null): string | undefined {
  if (!error) return undefined;
  if (error.code === "42501") return "Vous n'avez pas le droit de faire cette modification.";
  if (error.code === "23505") return "Cet élément existe déjà.";
  if (error.code === "P0001") return error.message;
  return "L'enregistrement a échoué. Réessayez dans un instant.";
}

function fieldErrors(issues: z.core.$ZodIssue[]): FormState {
  const errors: Record<string, string> = {};
  for (const issue of issues) errors[String(issue.path[0])] = issue.message;
  return { fieldErrors: errors };
}

const uuid = z.uuid("Choix invalide.");
const text = z
  .string()
  .trim()
  .transform((v) => v || null);
const date = z
  .string()
  .trim()
  .transform((v) => v || null)
  .refine((v) => v === null || !Number.isNaN(Date.parse(v)), "Date invalide.");
const phone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return null;
    const parsed = parseIvorianPhone(v);
    if (!parsed) {
      ctx.addIssue({ code: "custom", message: "Numéro invalide : 10 chiffres, par exemple 07 08 31 04 33." });
      return z.NEVER;
    }
    return parsed.e164;
  });

const personSchema = z.object({
  last_name: z.string().trim().min(1, "Saisissez le nom."),
  first_name: z.string().trim().min(1, "Saisissez le prénom."),
  sex: z.enum(["F", "M"], "Choisissez Homme ou Femme."),
  birth_date: date,
  phone,
  whatsapp: phone,
  relative_phone: phone,
  commune: text,
  district: text,
  landmark: text,
  status: z.string().trim().min(1),
  marital_status: text,
  arrived_at: date,
  baptized_at: date,
  brought_by: text,
  unattached_reason: text,
  weekday_exempt: z.preprocess((v) => v === "on", z.boolean()),
});

function readPerson(formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  return personSchema.safeParse({ ...raw, weekday_exempt: raw.weekday_exempt ?? "" });
}

// ---------------------------------------------------------------------------
// Fiche
// ---------------------------------------------------------------------------
export async function createPersonRecord(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = readPerson(formData);
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("people")
    .insert({ ...parsed.data, created_by: user?.id })
    .select("id")
    .single();
  if (error || !data) return { error: explain(error) };
  revalidatePath("/fideles");
  redirect(`/fideles/${data.id}?cree=1`);
}

export async function updatePerson(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = uuid.safeParse(formData.get("person_id"));
  if (!id.success) return { error: "Fiche inconnue." };
  const parsed = readPerson(formData);
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  if (parsed.data.brought_by === id.data) return { fieldErrors: { brought_by: "Une personne ne s'amène pas elle-même." } };

  const supabase = await createClient();
  const { data, error } = await supabase.from("people").update(parsed.data).eq("id", id.data).select("id");
  if (error) return { error: explain(error) };
  if (!data?.length) return { error: "Vous n'avez pas le droit de modifier cette fiche." };
  revalidatePath(`/fideles/${id.data}`);
  return { success: "Fiche enregistrée." };
}

/** Le père de famille (ou un responsable) inscrit une nouvelle personne dans son groupe. */
export async function addPersonToGroup(_prev: FormState, formData: FormData): Promise<FormState> {
  const schema = z.object({
    group_id: uuid,
    last_name: z.string().trim().min(1, "Saisissez le nom."),
    first_name: z.string().trim().min(1, "Saisissez le prénom."),
    sex: z.enum(["F", "M"], "Choisissez Homme ou Femme."),
    phone,
  });
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_person_to_group", {
    target_group: parsed.data.group_id,
    p_first_name: parsed.data.first_name,
    p_last_name: parsed.data.last_name,
    p_sex: parsed.data.sex,
    p_phone: parsed.data.phone ?? undefined,
  });
  if (error) return { error: error.code === "42501" ? error.message : explain(error) };
  revalidatePath("/famille");
  return { success: `${parsed.data.first_name} ${parsed.data.last_name} fait maintenant partie de la famille.` };
}

// ---------------------------------------------------------------------------
// Compte de connexion
// ---------------------------------------------------------------------------
async function checkCanManage(personId: string): Promise<string | undefined> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("can_manage_person", { target: personId });
  if (error || data !== true) return "Vous n'avez pas le droit de gérer l'accès de cette personne.";
}

/**
 * Crée l'accès à l'appli d'une personne : identifiant = son numéro, mot de passe
 * de départ généré et affiché une seule fois. Clé secrète utilisée seulement après
 * vérification (can_manage_person) ; l'opération est inscrite au journal.
 */
export async function createAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = uuid.safeParse(formData.get("person_id"));
  if (!id.success) return { error: "Fiche inconnue." };
  const denied = await checkCanManage(id.data);
  if (denied) return { error: denied };

  const admin = createAdminClient();
  const { data: person } = await admin.from("people").select("phone").eq("id", id.data).single();
  const parsedPhone = person?.phone ? parseIvorianPhone(person.phone) : null;
  if (!parsedPhone) return { error: "Ajoutez d'abord un numéro de téléphone valide dans la fiche." };
  const { data: existing } = await admin.from("users").select("user_id").eq("person_id", id.data).maybeSingle();
  if (existing) return { error: "Cette personne a déjà un compte." };

  const password = generateStarterPassword();
  const { data: created, error } = await admin.auth.admin.createUser({
    email: phoneToAuthEmail(parsedPhone),
    password,
    email_confirm: true,
  });
  if (error || !created.user) {
    return {
      error: error?.code === "email_exists"
        ? "Ce numéro est déjà utilisé par un autre compte."
        : "La création du compte a échoué. Réessayez dans un instant.",
    };
  }
  const { error: linkError } = await admin.from("users").insert({ user_id: created.user.id, person_id: id.data });
  if (linkError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: "La création du compte a échoué. Réessayez dans un instant." };
  }
  await logAccountEvent("account_created", created.user.id, id.data);

  revalidatePath(`/fideles/${id.data}`);
  return {
    success: `Compte créé. Mot de passe de départ : ${password} — notez-le et remettez-le à la personne. Il ne sera plus affiché.`,
  };
}

/** Donne un nouveau mot de passe de départ (mot de passe oublié). */
export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = uuid.safeParse(formData.get("person_id"));
  if (!id.success) return { error: "Fiche inconnue." };
  const denied = await checkCanManage(id.data);
  if (denied) return { error: denied };

  const admin = createAdminClient();
  const { data: link } = await admin.from("users").select("user_id").eq("person_id", id.data).maybeSingle();
  if (!link) return { error: "Cette personne n'a pas encore de compte." };
  const password = generateStarterPassword();
  const { error } = await admin.auth.admin.updateUserById(link.user_id, { password });
  if (error) return { error: "Le changement a échoué. Réessayez dans un instant." };
  await logAccountEvent("password_reset", link.user_id, id.data);
  return {
    success: `Nouveau mot de passe : ${password} — notez-le et remettez-le à la personne. Il ne sera plus affiché.`,
  };
}

/** Inscrit au journal une opération faite avec la clé secrète (qui, quoi, quand). */
async function logAccountEvent(event: string, userId: string, personId: string) {
  const actor = await getCurrentUser();
  await createAdminClient()
    .from("audit_log")
    .insert({
      actor_id: actor?.id ?? null,
      action: event === "account_created" ? "INSERT" : "UPDATE",
      table_name: "auth.users",
      record_id: userId,
      after: { event, person_id: personId },
    });
}

// ---------------------------------------------------------------------------
// Familles : transfert (administrateur) et délégation (père de famille)
// ---------------------------------------------------------------------------
/** Change la famille d'une personne : l'ancienne appartenance est close, l'historique gardé. */
export async function transferFamily(_prev: FormState, formData: FormData): Promise<FormState> {
  const schema = z.object({ person_id: uuid, family_id: z.union([uuid, z.literal("")]) });
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Choix invalide." };
  const { person_id, family_id } = parsed.data;

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: familyType } = await supabase.from("group_types").select("id").eq("slug", "family").single();
  const { data: current } = await supabase
    .from("group_memberships")
    .select("id, group_id, groups!inner(type_id)")
    .eq("person_id", person_id)
    .eq("groups.type_id", familyType?.id ?? "")
    .is("end_date", null);
  if ((current ?? []).some((m) => m.group_id === family_id)) return { success: "Aucun changement." };

  const today = new Date().toISOString().slice(0, 10);
  for (const m of current ?? []) {
    const { data, error } = await supabase
      .from("group_memberships")
      .update({ end_date: today, function_id: null })
      .eq("id", m.id)
      .select("id");
    if (error) return { error: explain(error) };
    if (!data?.length) return { error: "Vous n'avez pas le droit de changer la famille de cette personne." };
  }
  if (family_id) {
    const { error } = await supabase
      .from("group_memberships")
      .insert({ group_id: family_id, person_id, created_by: user?.id });
    if (error) return { error: explain(error) };
  }
  revalidatePath(`/fideles/${person_id}`);
  return { success: family_id ? "Transfert enregistré." : "La personne n'est plus rattachée à une famille." };
}

export async function createDelegation(_prev: FormState, formData: FormData): Promise<FormState> {
  const schema = z.object({
    family_id: uuid,
    person_id: z.uuid("Choisissez le délégué dans la liste."),
    label: text,
  });
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const members = formData.getAll("members").map(String);
  if (members.length === 0) return { error: "Cochez au moins un fidèle à confier." };
  if (members.includes(parsed.data.person_id)) return { error: "Le délégué ne peut pas se suivre lui-même." };

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: delegation, error } = await supabase
    .from("delegations")
    .insert({
      family_id: parsed.data.family_id,
      delegate_id: parsed.data.person_id,
      label: parsed.data.label,
      created_by: user?.id,
    })
    .select("id")
    .single();
  if (error || !delegation) return { error: explain(error) };
  const { error: membersError } = await supabase
    .from("delegation_members")
    .insert(members.map((person_id) => ({ delegation_id: delegation.id, person_id })));
  if (membersError) {
    await supabase.from("delegations").delete().eq("id", delegation.id);
    return { error: explain(membersError) };
  }
  revalidatePath("/famille");
  return { success: "Délégation enregistrée : le délégué voit maintenant ces fidèles." };
}

/** Met fin à une délégation (date de fin = aujourd'hui), sans l'effacer. */
export async function endDelegation(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("delegation_id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase
    .from("delegations")
    .update({ end_date: new Date().toISOString().slice(0, 10) })
    .eq("id", id.data);
  revalidatePath("/famille");
}
