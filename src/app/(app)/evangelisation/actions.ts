"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/app/actions/auth";
import { explain } from "@/lib/action-helpers";
import { parseIvorianPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

/** Saisie sur le terrain : la sortie du jour (même lieu) est créée ou reprise par la base. */
export async function quickContact(_prev: FormState, formData: FormData): Promise<FormState> {
  const text = (k: string) => String(formData.get(k) ?? "").trim();
  if (!text("first_name")) return { fieldErrors: { first_name: "Prénom ?" } };
  if (!text("last_name")) return { fieldErrors: { last_name: "Nom ?" } };
  let phone = "";
  if (text("phone")) {
    const p = parseIvorianPhone(text("phone"));
    if (!p) return { fieldErrors: { phone: "Numéro ivoirien à 10 chiffres (ex. 07 08 31 04 33)." } };
    phone = p.e164;
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("quick_outreach_contact", {
    p_first_name: text("first_name"),
    p_last_name: text("last_name"),
    p_phone: phone,
    p_district: text("district"),
    p_decision: text("decision"),
    p_note: text("note"),
    p_zone: text("zone"),
  });
  if (error) return { error: explain(error) };
  revalidatePath("/evangelisation");
  return { success: `${text("first_name")} est noté(e). Que Dieu fasse germer la semence !` };
}

/** Coche (ou décoche) « invité(e) » pour ce culte. */
export async function markInvited(formData: FormData): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("mark_outreach_invited", {
    p_contact: String(formData.get("contact_id") ?? ""),
    p_invited: formData.get("invited") === "1",
  });
  revalidatePath("/evangelisation");
}
