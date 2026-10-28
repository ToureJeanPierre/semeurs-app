"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/app/actions/auth";
import { explain, fieldErrors } from "@/lib/action-helpers";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  body: z.string().trim().min(3, "Écrivez votre sujet de prière.").max(1000),
  confidential: z.enum(["on"]).optional(),
});

export async function addPrayerRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = requestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("my_access");
  const { error } = await supabase.from("prayer_requests").insert({
    author_id: (me as { person_id?: string } | null)?.person_id,
    body: parsed.data.body,
    confidential: parsed.data.confidential === "on",
  });
  if (error) return { error: explain(error) };
  revalidatePath("/priere");
  return { success: "Votre sujet est déposé. L'église prie avec vous." };
}

export async function prayFor(formData: FormData): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("pray_for", { p_request: String(formData.get("request_id") ?? "") });
  revalidatePath("/priere");
}

export async function markAnswered(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prayer_requests")
    .update({ status: "answered", answered_note: String(formData.get("answered_note") ?? "").trim() || null, answered_at: new Date().toISOString() })
    .eq("id", String(formData.get("request_id") ?? ""))
    .select("id");
  if (error) return { error: explain(error) };
  if (!data?.length) return { error: "Seul l'auteur peut témoigner de l'exaucement." };
  revalidatePath("/priere");
  return { success: "Gloire à Dieu ! Votre témoignage encourage toute l'église." };
}

export async function removePrayerRequest(formData: FormData): Promise<void> {
  const supabase = await createClient();
  await supabase.from("prayer_requests").delete().eq("id", String(formData.get("request_id") ?? ""));
  revalidatePath("/priere");
}
