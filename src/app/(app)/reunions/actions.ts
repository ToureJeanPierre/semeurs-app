"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/app/actions/auth";
import { explain, fieldErrors, optional } from "@/lib/action-helpers";
import { createClient } from "@/lib/supabase/server";

/** Réunions : création par fonction sécurisée (create_meeting), le reste sous RLS. */

const meetingSchema = z
  .object({
    title: z.string().trim().min(3, "Donnez l'objet de la réunion."),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choisissez la date."),
    start: z.string().regex(/^\d{2}:\d{2}$/, "Heure de début ?"),
    end: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
    mode: z.enum(["in_person", "online", "hybrid"]),
    place: z.string().trim().max(200).optional(),
    agenda: z.string().trim().max(3000).optional(),
  })
  .refine((v) => v.mode === "online" || v.place, { path: ["place"], message: "Indiquez le lieu (réunion sur place)." });

export async function createMeeting(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = meetingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const v = parsed.data;
  const groups = formData.getAll("group_ids").map(String).filter(Boolean);
  const people = formData.getAll("person_ids").map(String).filter(Boolean);
  if (groups.length === 0 && people.length === 0) {
    return { error: "Invitez au moins un groupe ou une personne." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_meeting", {
    p_title: v.title,
    p_agenda: v.agenda ?? "",
    p_starts_at: `${v.date}T${v.start}:00Z`, // Abidjan = UTC
    p_ends_at: v.end ? `${v.date}T${v.end}:00Z` : null,
    p_mode: v.mode,
    p_place: v.place ?? "",
    p_group_ids: groups,
    p_person_ids: people,
  });
  if (error) return { error: explain(error) };
  revalidatePath("/reunions");
  redirect(`/reunions/${data}`);
}

export async function respondMeeting(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const id = String(formData.get("meeting_id") ?? "");
  await supabase.rpc("respond_meeting", { p_meeting: id, p_response: String(formData.get("response") ?? "") });
  revalidatePath(`/reunions/${id}`);
  revalidatePath("/reunions");
}

/** Après la réunion : présences, compte rendu, décisions ; la réunion passe « tenue ». */
export async function saveMinutes(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("meeting_id") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .update({ minutes: optional(formData.get("minutes")), decisions: optional(formData.get("decisions")), status: "held" })
    .eq("id", id)
    .select("id");
  if (error) return { error: explain(error) };
  if (!data?.length) return { error: "Seul l'organisateur tient le compte rendu." };
  const present = new Set(formData.getAll("present").map(String));
  const invitees = formData.getAll("invitee").map(String);
  for (const personId of invitees) {
    await supabase.from("meeting_invitees").update({ attended: present.has(personId) }).eq("meeting_id", id).eq("person_id", personId);
  }
  revalidatePath(`/reunions/${id}`);
  return { success: "Compte rendu et présences enregistrés." };
}

export async function cancelMeeting(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("meeting_id") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase.from("meetings").update({ status: "cancelled" }).eq("id", id).select("id");
  if (error) return { error: explain(error) };
  if (!data?.length) return { error: "Seul l'organisateur peut annuler." };
  revalidatePath(`/reunions/${id}`);
  revalidatePath("/reunions");
  return { success: "Réunion annulée : les invités sont prévenus." };
}

const taskSchema = z.object({
  meeting_id: z.string().uuid(),
  title: z.string().trim().min(3, "Décrivez la tâche."),
  assignee_id: z.string().optional(),
  due_on: z.string().optional(),
});

export async function addTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("meeting_tasks")
    .insert({ meeting_id: v.meeting_id, title: v.title, assignee_id: v.assignee_id || null, due_on: v.due_on || null });
  if (error) return { error: explain(error) };
  revalidatePath(`/reunions/${v.meeting_id}`);
  return { success: "Tâche ajoutée : la personne est prévenue." };
}

export async function toggleTask(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const done = formData.get("done") === "1";
  const { data } = await supabase
    .from("meeting_tasks")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", String(formData.get("task_id") ?? ""))
    .select("meeting_id")
    .maybeSingle();
  if (data) revalidatePath(`/reunions/${data.meeting_id}`);
  revalidatePath("/mon-espace");
}
