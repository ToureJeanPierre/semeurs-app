"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/app/actions/auth";
import { getAccess, hasAny } from "@/lib/access";
import { createAdminClient } from "@/lib/supabase/admin";

/** Recalcule les alertes tout de suite (sans attendre 6 h). Réservé au pasteur, à ses assistants, à l'administrateur. */
export async function recomputeAlerts(): Promise<FormState> {
  const access = await getAccess();
  if (!hasAny(access, ["alerts.manage", "settings.manage"])) return { error: "Vous n'avez pas ce droit." };
  const { data, error } = await createAdminClient().rpc("compute_alerts");
  if (error) return { error: "Le calcul a échoué. Réessayez dans un instant." };
  revalidatePath("/alertes");
  revalidatePath("/famille");
  return { success: data ? `${data} changement${data > 1 ? "s" : ""} de niveau.` : "Rien n'a changé depuis le dernier calcul." };
}
