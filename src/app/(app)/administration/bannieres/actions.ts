"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/app/actions/auth";
import { explain, fieldErrors, optional } from "@/lib/action-helpers";
import { createClient } from "@/lib/supabase/server";

const link = z
  .string()
  .trim()
  .regex(/^(\/|https:\/\/)/, "Une page de l'appli (/priere…) ou une adresse https://")
  .or(z.literal(""))
  .optional();

const schema = z.object({
  id: z.string().uuid().or(z.literal("")).optional(),
  eyebrow: z.string().trim().max(30, "30 caractères au plus").optional(),
  title: z.string().trim().min(2, "Titre ?").max(70, "70 caractères au plus"),
  subtitle: z.string().trim().max(160, "160 caractères au plus").optional(),
  cta_label: z.string().trim().max(30).optional(),
  cta_href: link,
  image_path: z.string().regex(/^[0-9a-f-]{36}\.jpg$/).or(z.literal("")).optional(),
  theme: z.string().min(1),
  effect: z.string().min(1),
  duration_seconds: z.coerce.number().int().min(3, "3 s au moins").max(20, "20 s au plus"),
  starts_on: z.string().optional(),
  ends_on: z.string().optional(),
});

/** Créer ou modifier une bannière. Une nouvelle image remplace l'ancienne (effacée du stockage). */
export async function savePromo(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const v = parsed.data;
  const supabase = await createClient();
  const row = {
    eyebrow: v.eyebrow || null,
    title: v.title,
    subtitle: v.subtitle || null,
    cta_label: v.cta_label || null,
    cta_href: v.cta_href || null,
    theme: v.theme,
    effect: v.effect,
    duration_seconds: v.duration_seconds,
    starts_on: optional(v.starts_on ?? null),
    ends_on: optional(v.ends_on ?? null),
    ...(v.image_path ? { image_path: v.image_path, image_url: null } : {}),
  };
  if (v.id) {
    const { data: old } = await supabase.from("promo_slides").select("image_path").eq("id", v.id).maybeSingle();
    const { error } = await supabase.from("promo_slides").update(row).eq("id", v.id);
    if (error) return { error: explain(error) };
    if (v.image_path && old?.image_path && old.image_path !== v.image_path) await supabase.storage.from("affiches").remove([old.image_path]);
  } else {
    const { count } = await supabase.from("promo_slides").select("id", { count: "exact", head: true });
    const { error } = await supabase.from("promo_slides").insert({ ...row, position: (count ?? 0) + 1 });
    if (error) return { error: explain(error) };
  }
  revalidatePath("/administration/bannieres");
  revalidatePath("/");
  return { success: v.id ? "Bannière modifiée." : "Bannière ajoutée : elle défile déjà sur l'accueil." };
}

export async function togglePromo(formData: FormData): Promise<void> {
  const supabase = await createClient();
  await supabase.from("promo_slides").update({ active: formData.get("active") === "1" }).eq("id", String(formData.get("id") ?? ""));
  revalidatePath("/administration/bannieres");
  revalidatePath("/");
}

/** Monter ou descendre une bannière dans l'ordre de passage. */
export async function movePromo(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const step = formData.get("dir") === "up" ? -1 : 1;
  const supabase = await createClient();
  const { data } = await supabase.from("promo_slides").select("id, position").order("position").order("created_at");
  const list = data ?? [];
  const i = list.findIndex((r) => r.id === id);
  const j = i + step;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((r, k) => supabase.from("promo_slides").update({ position: k + 1 }).eq("id", r.id)));
  revalidatePath("/administration/bannieres");
  revalidatePath("/");
}

export async function deletePromo(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { data } = await supabase.from("promo_slides").select("image_path").eq("id", id).maybeSingle();
  await supabase.from("promo_slides").delete().eq("id", id);
  if (data?.image_path) await supabase.storage.from("affiches").remove([data.image_path]);
  revalidatePath("/administration/bannieres");
  revalidatePath("/");
}
