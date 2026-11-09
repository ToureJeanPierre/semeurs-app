"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/app/actions/auth";
import { explain, optional } from "@/lib/action-helpers";
import { createClient } from "@/lib/supabase/server";

/** Le pasteur confirme qu'il a bien reçu (ou pas) une dîme déclarée. */
export async function confirmTithe(_prev: FormState, formData: FormData): Promise<FormState> {
  const received = formData.get("received") === "1";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tithes")
    .update({ status: received ? "received" : "not_received", pastor_note: optional(formData.get("note")) })
    .eq("id", String(formData.get("tithe_id") ?? ""))
    .select("id");
  if (error) return { error: explain(error) };
  if (!data?.length) return { error: "Réservé au pasteur." };
  revalidatePath("/dimes");
  return { success: received ? "Dîme confirmée." : "Dîme marquée non reçue." };
}
