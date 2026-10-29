"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/app/actions/auth";
import { explain, fieldErrors, optional } from "@/lib/action-helpers";
import { createClient } from "@/lib/supabase/server";

const trainingSchema = z.object({
  title: z.string().trim().min(3, "Titre ?"),
  description: z.string().trim().max(2000).optional(),
});

/** Nouvelle formation (église ou groupe) ; les leçons s'ajoutent ensuite. */
export async function createTraining(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = trainingSchema.safeParse({ title: formData.get("title"), description: formData.get("description") ?? undefined });
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const supabase = await createClient();
  const { error } = await supabase.from("trainings").insert({
    title: parsed.data.title,
    description: parsed.data.description || null,
    group_id: optional(formData.get("group_id")),
    integration_step_code: optional(formData.get("integration_step_code")),
  });
  if (error) return { error: explain(error) };
  revalidatePath("/formations");
  return { success: "Formation créée. Ouvrez-la pour ajouter les leçons." };
}

export async function addLesson(_prev: FormState, formData: FormData): Promise<FormState> {
  const trainingId = String(formData.get("training_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 2) return { fieldErrors: { title: "Titre de la leçon ?" } };
  const url = optional(formData.get("resource_url"));
  if (url && !url.startsWith("https://")) return { fieldErrors: { resource_url: "Le lien doit commencer par https://" } };
  const supabase = await createClient();
  const { count } = await supabase.from("training_lessons").select("id", { count: "exact", head: true }).eq("training_id", trainingId);
  const { error } = await supabase.from("training_lessons").insert({
    training_id: trainingId,
    title,
    content: optional(formData.get("content")),
    resource_url: url,
    position: (count ?? 0) + 1,
  });
  if (error) return { error: explain(error) };
  revalidatePath(`/formations/${trainingId}`);
  return { success: "Leçon ajoutée." };
}

export async function deleteLesson(formData: FormData): Promise<void> {
  const supabase = await createClient();
  await supabase.from("training_lessons").delete().eq("id", String(formData.get("lesson_id") ?? ""));
  revalidatePath(`/formations/${String(formData.get("training_id") ?? "")}`);
}

/** Inscription : soi-même (bouton « Je m'inscris ») ou une personne choisie par le responsable. */
export async function enroll(_prev: FormState, formData: FormData): Promise<FormState> {
  const trainingId = String(formData.get("training_id") ?? "");
  const supabase = await createClient();
  let personId = optional(formData.get("person_id"));
  if (!personId) {
    const { data: me } = await supabase.rpc("my_access");
    personId = (me as { person_id?: string } | null)?.person_id ?? null;
  }
  if (!personId) return { fieldErrors: { person_id: "Choisissez une personne." } };
  const { error } = await supabase.from("training_enrollments").insert({ training_id: trainingId, person_id: personId });
  if (error) return { error: error.code === "23505" ? "Déjà inscrit(e)." : explain(error) };
  revalidatePath("/formations");
  revalidatePath(`/formations/${trainingId}`);
  return { success: "Inscription enregistrée." };
}

/** Coche ou décoche une leçon pour un participant (la dernière coche délivre l'attestation). */
export async function toggleLesson(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const row = { lesson_id: String(formData.get("lesson_id") ?? ""), person_id: String(formData.get("person_id") ?? "") };
  if (formData.get("done") === "1") {
    const { data: me } = await supabase.rpc("my_access");
    await supabase.from("lesson_progress").insert({ ...row, validated_by: (me as { person_id?: string } | null)?.person_id ?? null });
  } else {
    await supabase.from("lesson_progress").delete().match(row);
  }
  revalidatePath(`/formations/${String(formData.get("training_id") ?? "")}`);
}

export async function archiveTraining(formData: FormData): Promise<void> {
  const supabase = await createClient();
  await supabase.from("trainings").update({ active: false }).eq("id", String(formData.get("training_id") ?? ""));
  revalidatePath("/formations");
}
