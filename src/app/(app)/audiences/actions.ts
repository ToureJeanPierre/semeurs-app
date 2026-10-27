"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/app/actions/auth";
import { getAccess } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/** Demande d'audience sur un créneau libre (docs/01 §10.4). */
export async function requestAppointment(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({
      starts_at: z.iso.datetime({ offset: true, message: "Choisissez un créneau." }),
      topic: z.string().trim().max(300).transform((v) => v || null),
    })
    .safeParse({ starts_at: formData.get("starts_at"), topic: formData.get("topic") ?? "" });
  if (!parsed.success) return { error: "Choisissez un créneau." };
  const [access, user] = await Promise.all([getAccess(), getCurrentUser()]);
  if (!access.personId) return { error: "Votre compte n'est pas rattaché à une fiche." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .insert({ person_id: access.personId, starts_at: parsed.data.starts_at, topic: parsed.data.topic, created_by: user?.id });
  if (error) return { error: error.code === "23505" ? "Ce créneau vient d'être pris. Choisissez-en un autre." : "La demande a échoué." };
  revalidatePath("/audiences");
  return { success: "Demande envoyée. Vous recevrez une notification quand le pasteur l'aura confirmée." };
}

/** Pasteur : confirmer, annuler, marquer comme reçue. Fidèle : annuler sa demande. */
export async function setAppointmentStatus(formData: FormData): Promise<void> {
  const parsed = z
    .object({ id: z.uuid(), status: z.enum(["confirmed", "cancelled", "done"]) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from("appointments").update({ status: parsed.data.status }).eq("id", parsed.data.id);
  revalidatePath("/audiences");
}
