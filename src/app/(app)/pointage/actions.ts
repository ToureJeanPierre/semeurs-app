"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";

/** Ouvre (ou retrouve) le pointage d'un culte à une date, puis affiche la liste. */
export async function openServiceSession(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ service_type_id: z.uuid(), session_date: z.iso.date("Date invalide.") })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Choisissez un culte et une date." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_service_session", {
    p_service_type: parsed.data.service_type_id,
    p_date: parsed.data.session_date,
  });
  if (error || !data) return { error: error?.message ?? "Ouverture impossible. Réessayez." };
  redirect(`/pointage/${data}`);
}
