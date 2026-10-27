import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageTitle } from "@/components/admin/AdminCard";
import { WhatsappList, type WhatsappRow } from "@/components/messages/WhatsappList";
import { createClient } from "@/lib/supabase/server";
import { markWhatsappSent } from "../actions";

export const metadata: Metadata = { title: "Envoi WhatsApp" };

export default async function WhatsappSendPage({ params }: PageProps<"/messages/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: broadcast }, { data: rows }] = await Promise.all([
    supabase.from("broadcasts").select("id, title, body").eq("id", id).maybeSingle(),
    supabase.rpc("broadcast_whatsapp_list", { p_broadcast: id }),
  ]);
  if (!broadcast) notFound();

  async function mark(personId: string) {
    "use server";
    await markWhatsappSent(id, personId);
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle
        title={broadcast.title}
        intro="Touchez « Envoyer » : WhatsApp s'ouvre avec le message déjà écrit pour la personne. Revenez ensuite ici pour la suivante."
      />
      <WhatsappList rows={(rows ?? []) as WhatsappRow[]} body={broadcast.body} markSent={mark} />
    </div>
  );
}
