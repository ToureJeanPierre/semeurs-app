"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/app/actions/auth";
import { explain, fieldErrors } from "@/lib/action-helpers";
import { parseIvorianPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

/** Suivi des âmes. La base vérifie le périmètre (gagneur, assigné, responsable évangélisation). */

async function myPersonId() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_access");
  return (data as { person_id?: string } | null)?.person_id ?? null;
}

const soulSchema = z.object({
  first_name: z.string().trim().min(1, "Prénom ?"),
  last_name: z.string().trim().min(1, "Nom ?"),
  sex: z.enum(["M", "F", ""]).optional(),
  phone: z.string().optional(),
  district: z.string().trim().max(100).optional(),
  status: z.string().min(1),
  brought_by: z.string().optional(),
  note: z.string().trim().max(500).optional(),
  contact_id: z.string().optional(),
});

/** Fiche rapide de première visite (ou conversion d'un contact terrain). */
export async function registerSoul(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = soulSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const v = parsed.data;
  let phone: string | null = null;
  if (v.phone?.trim()) {
    const p = parseIvorianPhone(v.phone);
    if (!p) return { fieldErrors: { phone: "Numéro ivoirien à 10 chiffres (ex. 07 08 31 04 33)." } };
    phone = p.e164;
  }
  const supabase = await createClient();
  const me = await myPersonId();
  const { data, error } = await supabase.rpc("register_soul", {
    p_first_name: v.first_name,
    p_last_name: v.last_name,
    p_sex: v.sex ?? "",
    p_phone: phone ?? "",
    p_district: v.district ?? "",
    p_status: v.status,
    p_brought_by: v.brought_by || me,
    p_note: v.note ?? "",
    p_contact: v.contact_id || null,
  });
  if (error) return { error: explain(error) };
  revalidatePath("/ames", "layout");
  redirect(`/ames/${data}?nouvelle=1`);
}

/** Coche ou décoche une étape du parcours d'intégration. */
export async function toggleStep(formData: FormData): Promise<void> {
  const personId = String(formData.get("person_id") ?? "");
  const stepId = String(formData.get("step_id") ?? "");
  const supabase = await createClient();
  if (formData.get("done") === "1") {
    await supabase.from("person_steps").insert({ person_id: personId, step_id: stepId, done_by: await myPersonId() });
  } else {
    await supabase.from("person_steps").delete().eq("person_id", personId).eq("step_id", stepId);
  }
  revalidatePath(`/ames/${personId}`);
  revalidatePath("/ames");
}

export async function assignSoul(_prev: FormState, formData: FormData): Promise<FormState> {
  const personId = String(formData.get("person_id") ?? "");
  const assignee = String(formData.get("assignee_id") ?? "");
  if (!assignee) return { fieldErrors: { assignee_id: "Choisissez un membre de l'évangélisation." } };
  const supabase = await createClient();
  const { error } = await supabase.from("soul_assignments").insert({ person_id: personId, assignee_id: assignee });
  if (error) return { error: explain(error) };
  revalidatePath(`/ames/${personId}`);
  return { success: "Âme confiée : la personne est prévenue." };
}

export async function endAssignment(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("soul_assignments")
    .update({ end_date: new Date().toISOString().slice(0, 10) })
    .eq("id", String(formData.get("assignment_id") ?? ""))
    .select("person_id")
    .maybeSingle();
  if (data) revalidatePath(`/ames/${data.person_id}`);
}

const outingSchema = z.object({
  outing_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date ?"),
  zone: z.string().trim().min(2, "Indiquez la zone (quartier, marché…)."),
  group_id: z.string().optional(),
  note: z.string().trim().max(500).optional(),
});

export async function createOuting(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = outingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const supabase = await createClient();
  const id = crypto.randomUUID();
  const { error } = await supabase
    .from("outreach_outings")
    .insert({ id, ...parsed.data, group_id: parsed.data.group_id || null, note: parsed.data.note || null });
  if (error) return { error: explain(error) };
  revalidatePath("/ames/sorties");
  redirect(`/ames/sorties/${id}`);
}

const contactSchema = z.object({
  outing_id: z.string().uuid(),
  first_name: z.string().trim().min(1, "Prénom ?"),
  last_name: z.string().trim().min(1, "Nom ?"),
  phone: z.string().optional(),
  district: z.string().trim().max(100).optional(),
  decision: z.string().min(1),
  met_by: z.string().optional(),
  note: z.string().trim().max(500).optional(),
});

/** Contact rencontré pendant une sortie (pas encore une fiche : on la crée s'il le souhaite). */
export async function addOutreachContact(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const v = parsed.data;
  let phone: string | null = null;
  if (v.phone?.trim()) {
    const p = parseIvorianPhone(v.phone);
    if (!p) return { fieldErrors: { phone: "Numéro ivoirien à 10 chiffres." } };
    phone = p.e164;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("outreach_contacts").insert({
    ...v,
    phone,
    district: v.district || null,
    note: v.note || null,
    met_by: v.met_by || (await myPersonId()),
  });
  if (error) return { error: explain(error) };
  revalidatePath(`/ames/sorties/${v.outing_id}`);
  return { success: "Contact noté." };
}
