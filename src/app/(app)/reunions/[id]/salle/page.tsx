import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getAccess } from "@/lib/access";
import { roomUrl } from "@/lib/meeting-room";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Salle de réunion" };

/** La salle en ligne s'ouvre dans l'appli : rien à installer, aucun compte à créer. */
export default async function MeetingRoomPage({ params }: PageProps<"/reunions/[id]/salle">) {
  const { id } = await params;
  const supabase = await createClient();
  const access = await getAccess();
  const [{ data: m }, { data: me }] = await Promise.all([
    supabase.from("meetings").select("title, online_url, status").eq("id", id).maybeSingle(),
    access.personId ? supabase.from("people").select("first_name, last_name").eq("id", access.personId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!m?.online_url || m.status !== "planned") notFound();
  const url = roomUrl(m.online_url, me ? `${me.first_name} ${me.last_name}` : "Invité");

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] flex-col gap-2 px-2 pb-2 pt-2">
      <p className="px-2 text-sm text-muted">Autorisez la caméra et le micro quand le téléphone le demande.</p>
      <iframe
        src={url}
        title={`Salle : ${m.title}`}
        allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
        className="min-h-0 w-full flex-1 rounded-card border-0 bg-night"
      />
      <a href={url} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center gap-2 text-sm font-semibold text-royal">
        <ExternalLink aria-hidden className="size-4" /> Si l&apos;image ne s&apos;affiche pas : ouvrir dans le navigateur
      </a>
    </div>
  );
}
