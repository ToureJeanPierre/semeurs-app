import { createClient } from "@/lib/supabase/server";

/** Message par défaut si le modèle a disparu de la base (il se modifie dans Administration → Paramètres). */
export const ABSENCE_FALLBACK =
  "Bonjour {prénom}, on ne vous a pas vu au culte depuis quelque temps. Tout va bien ? Que Dieu vous bénisse.";

/** Texte d'un modèle de message (`message_templates`), ou le texte de secours. */
export async function loadMessageTemplate(code: string, fallback: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.from("message_templates").select("body").eq("code", code).maybeSingle();
  return data?.body ?? fallback;
}
