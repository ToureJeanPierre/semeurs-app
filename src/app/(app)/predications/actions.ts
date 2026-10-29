"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/app/actions/auth";
import { explain, fieldErrors } from "@/lib/action-helpers";
import { createClient } from "@/lib/supabase/server";

const sermonSchema = z.object({
  title: z.string().trim().min(2, "Titre ?"),
  sermon_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date ?"),
  preacher_id: z.string().optional(),
  preacher_name: z.string().trim().max(120).optional(),
  theme: z.string().trim().max(200).optional(),
  bible_text: z.string().trim().max(200).optional(),
  summary: z.string().trim().max(5000).optional(),
  media_url: z.string().trim().url("Lien invalide (https://…).").optional().or(z.literal("")),
  audio_path: z.string().optional(),
});

/** Le fichier audio est déjà envoyé par le téléphone vers le stockage ; on enregistre la fiche. */
export async function saveSermon(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = sermonSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const v = parsed.data;
  if (!v.preacher_id && !v.preacher_name) return { fieldErrors: { preacher_id: "Indiquez le prédicateur." } };
  if (!v.media_url && !v.audio_path) return { fieldErrors: { media_url: "Ajoutez l'enregistrement audio ou un lien (YouTube, Facebook)." } };
  const supabase = await createClient();
  const { error } = await supabase.from("sermons").insert({
    title: v.title,
    sermon_date: v.sermon_date,
    preacher_id: v.preacher_id || null,
    preacher_name: v.preacher_id ? null : v.preacher_name || null,
    theme: v.theme || null,
    bible_text: v.bible_text || null,
    summary: v.summary || null,
    media_url: v.media_url || null,
    audio_path: v.audio_path || null,
  });
  if (error) return { error: explain(error) };
  revalidatePath("/predications");
  return { success: "Prédication publiée." };
}

export async function deleteSermon(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.from("sermons").delete().eq("id", String(formData.get("sermon_id") ?? "")).select("audio_path").maybeSingle();
  if (data?.audio_path) await supabase.storage.from("predications").remove([data.audio_path]);
  revalidatePath("/predications");
}
