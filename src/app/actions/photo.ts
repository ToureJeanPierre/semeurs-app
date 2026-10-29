"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Enregistre (ou retire) la photo d'une fiche ; l'ancienne image est effacée du stockage. */
export async function setPersonPhoto(personId: string, path: string | null): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: old, error } = await supabase.rpc("set_person_photo", { p_person: personId, p_path: path });
  if (error) {
    if (path) await supabase.storage.from("photos").remove([path]);
    return { error: error.code === "42501" ? "Vous ne pouvez pas changer cette photo." : "La photo n'a pas pu être enregistrée." };
  }
  if (old && old !== path) await supabase.storage.from("photos").remove([old as string]);
  revalidatePath("/", "layout");
  return {};
}
