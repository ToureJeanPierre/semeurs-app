"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/app/actions/auth";
import { explain, fieldErrors } from "@/lib/action-helpers";
import { createClient } from "@/lib/supabase/server";

const eventSchema = z.object({
  title: z.string().trim().min(3, "Titre ?"),
  kind: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date ?"),
  start: z.string().regex(/^\d{2}:\d{2}$/, "Heure ?"),
  end_date: z.string().optional(),
  end: z.string().optional(),
  place: z.string().trim().max(200).optional(),
  description: z.string().trim().max(3000).optional(),
  registration: z.enum(["on"]).optional(),
  capacity: z.string().optional(),
});

/** Nouvel événement de l'église : annoncé à tous (notification sur le téléphone). */
export async function createChurchEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = eventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("church_events").insert({
    title: v.title,
    kind: v.kind,
    starts_at: `${v.date}T${v.start}:00Z`,
    ends_at: v.end ? `${v.end_date || v.date}T${v.end}:00Z` : null,
    place: v.place || null,
    description: v.description || null,
    registration: v.registration === "on",
    capacity: v.capacity ? Number(v.capacity) || null : null,
  });
  if (error) return { error: explain(error) };
  revalidatePath("/evenements");
  return { success: "Événement publié et annoncé à tous." };
}

export async function toggleRegistration(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("my_access");
  const row = { event_id: String(formData.get("event_id") ?? ""), person_id: (me as { person_id?: string } | null)?.person_id };
  if (formData.get("register") === "1") await supabase.from("event_registrations").insert(row);
  else await supabase.from("event_registrations").delete().match(row);
  revalidatePath("/evenements");
}

export async function deleteChurchEvent(formData: FormData): Promise<void> {
  const supabase = await createClient();
  await supabase.from("church_events").delete().eq("id", String(formData.get("event_id") ?? ""));
  revalidatePath("/evenements");
}
