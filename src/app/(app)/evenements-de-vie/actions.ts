"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/app/actions/auth";
import { explain, fieldErrors } from "@/lib/action-helpers";
import { createClient } from "@/lib/supabase/server";

const eventSchema = z.object({
  person_id: z.string().uuid("Choisissez la personne concernée."),
  kind: z.string().min(1),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choisissez la date."),
  note: z.string().trim().max(500).optional(),
});

/** Signaler un événement de vie : le père de famille et le pasteur sont prévenus (base). */
export async function reportLifeEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = eventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("my_access");
  const { error } = await supabase
    .from("life_events")
    .insert({ ...parsed.data, note: parsed.data.note || null, reported_by: (me as { person_id?: string } | null)?.person_id });
  if (error) return { error: explain(error) };
  revalidatePath("/evenements-de-vie");
  return { success: "Merci : le père de famille et le pasteur sont prévenus." };
}

const visitSchema = z.object({
  event_id: z.string().uuid(),
  person_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choisissez la date de la visite."),
  label: z.string(),
});

/** « Prévoir une visite » : inscrit au journal de suivi de la personne, avec la date. */
export async function planVisit(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = visitSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("my_access");
  const { error } = await supabase.from("follow_ups").insert({
    person_id: parsed.data.person_id,
    author_id: (me as { person_id?: string } | null)?.person_id,
    channel: "visit",
    result: "other",
    note: `Visite prévue (${parsed.data.label})`,
    next_action_on: parsed.data.date,
  });
  if (error) return { error: explain(error) };
  revalidatePath("/evenements-de-vie");
  return { success: "Visite inscrite au journal de suivi." };
}

export async function closeLifeEvent(formData: FormData): Promise<void> {
  const supabase = await createClient();
  await supabase.from("life_events").update({ status: "closed" }).eq("id", String(formData.get("event_id") ?? ""));
  revalidatePath("/evenements-de-vie");
}
