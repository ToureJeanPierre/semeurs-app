"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/app/actions/auth";
import { getAccess } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const absenceSchema = z
  .object({
    person_id: z.uuid().optional(),
    starts_on: z.iso.date("Choisissez la date de début."),
    ends_on: z.iso.date("Choisissez la date de fin."),
    reason: z.string().min(1),
    note: z
      .string()
      .trim()
      .transform((v) => v || null),
  })
  .refine((v) => v.ends_on >= v.starts_on, { message: "La fin doit être après le début.", path: ["ends_on"] });

/** Absence justifiée (voyage, maladie…) : les alertes sont suspendues pendant ces dates. */
export async function declareAbsence(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = absenceSchema.safeParse({ ...raw, person_id: raw.person_id || undefined, note: raw.note ?? "" });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] = issue.message;
    return { fieldErrors: errors };
  }
  const [access, user] = await Promise.all([getAccess(), getCurrentUser()]);
  const personId = parsed.data.person_id ?? access.personId;
  if (!personId) return { error: "Votre compte n'est pas encore rattaché à une fiche." };
  const supabase = await createClient();
  const { error } = await supabase.from("excused_absences").insert({
    person_id: personId,
    starts_on: parsed.data.starts_on,
    ends_on: parsed.data.ends_on,
    reason: parsed.data.reason,
    note: parsed.data.note,
    created_by: user?.id,
  });
  if (error) return { error: error.code === "42501" ? "Vous ne pouvez pas déclarer cette absence." : "L'enregistrement a échoué." };
  revalidatePath("/mon-espace");
  revalidatePath(`/fideles/${personId}`);
  return { success: "Absence enregistrée : pas d'alerte pendant ces dates." };
}

export async function removeAbsence(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("absence_id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("excused_absences").delete().eq("id", id.data);
  revalidatePath("/mon-espace");
}

const positionSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  accuracy: z.coerce.number().min(0).max(100000).optional(),
});

/** « Je suis à la maison » : enregistre la position de mon domicile (visible du seul périmètre autorisé). */
export async function saveMyHome(input: { lat: number; lng: number; accuracy?: number }): Promise<FormState> {
  const parsed = positionSchema.safeParse(input);
  if (!parsed.success) return { error: "Position invalide. Réessayez." };
  const [access, user] = await Promise.all([getAccess(), getCurrentUser()]);
  if (!access.personId) return { error: "Votre compte n'est pas rattaché à une fiche." };
  const supabase = await createClient();
  const { error } = await supabase.from("people_locations").upsert({
    person_id: access.personId,
    lat: parsed.data.lat,
    lng: parsed.data.lng,
    accuracy_m: parsed.data.accuracy ? Math.round(parsed.data.accuracy) : null,
    set_at: new Date().toISOString(),
    set_by: user?.id,
  });
  if (error) return { error: "L'enregistrement a échoué. Réessayez." };
  revalidatePath("/mon-espace");
  return { success: "Votre maison est enregistrée. Seuls votre père de famille, votre délégué et le pasteur la voient." };
}
