"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  title: z.string().trim().min(1, "Donnez un titre.").max(120),
  body: z.string().trim().min(1, "Écrivez le message.").max(2000),
  channel: z.enum(["app", "whatsapp"]),
});

/** Message groupé : notification dans l'appli, ou WhatsApp assisté (un message prêt par destinataire). */
export async function sendBroadcast(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] = issue.message;
    return { fieldErrors: errors };
  }
  const targets = formData.getAll("targets").map(String);
  if (targets.length === 0) return { error: "Choisissez à qui envoyer le message." };
  const groupIds = targets.includes("church") ? null : targets;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_broadcast", {
    p_title: parsed.data.title,
    p_body: parsed.data.body,
    p_group_ids: groupIds ?? [],
    p_channel: parsed.data.channel,
  });
  if (error || !data) return { error: error?.code === "42501" ? error.message : "L'envoi a échoué. Réessayez." };
  revalidatePath("/messages");
  if (parsed.data.channel === "whatsapp") redirect(`/messages/${data}`);
  return { success: "Message envoyé : il apparaît dans les notifications des destinataires qui ont l'appli." };
}

/** WhatsApp assisté : coche le destinataire dès que la conversation a été ouverte. */
export async function markWhatsappSent(broadcastId: string, personId: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("broadcast_recipients")
    .update({ sent_at: new Date().toISOString() })
    .eq("broadcast_id", broadcastId)
    .eq("person_id", personId);
}
