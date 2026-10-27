import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Megaphone } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { BroadcastForm, type Target } from "@/components/messages/BroadcastForm";
import { EditToggle } from "@/components/people/EditToggle";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { sendBroadcast } from "./actions";

export const metadata: Metadata = { title: "Annonces" };

const when = new Intl.DateTimeFormat("fr-CI", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Abidjan" });

export default async function MessagesPage() {
  const supabase = await createClient();
  const [{ data: received }, { data: targets }, { data: templates }, { data: sent }] = await Promise.all([
    supabase.from("notifications").select("id, title, body, created_at").eq("kind", "message").order("created_at", { ascending: false }).limit(30),
    supabase.rpc("my_message_targets"),
    supabase.from("message_templates").select("code, label, body").order("label"),
    supabase.from("broadcasts").select("id, title, channel, recipient_count, created_at").order("created_at", { ascending: false }).limit(10),
  ]);
  const t = (targets ?? { church: false, groups: [] }) as { church: boolean; groups: Target[] };
  const canSend = t.church || t.groups.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pb-8 pt-5">
      <PageTitle title="Annonces" intro="Les messages de l'église et de vos groupes." />

      {canSend && (
        <EditToggle label="Nouveau message">
          <Card className="shadow-card">
            <BroadcastForm action={sendBroadcast} church={t.church} groups={t.groups} templates={templates ?? []} />
          </Card>
        </EditToggle>
      )}

      {(received ?? []).length === 0 ? (
        <p className="rounded-card bg-surface p-4 text-muted">Aucune annonce pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {(received ?? []).map((m) => (
            <li key={m.id}>
              <Card className="flex gap-3 shadow-card">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-royal text-white">
                  <Megaphone aria-hidden className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">{m.title}</p>
                  {m.body && <p className="mt-1 whitespace-pre-wrap">{m.body}</p>}
                  <p className="mt-1 text-xs text-muted">{when.format(new Date(m.created_at))}</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {canSend && (sent ?? []).length > 0 && (
        <section aria-labelledby="envoyes">
          <h2 id="envoyes" className="mb-2 text-lg font-semibold">Mes messages envoyés</h2>
          <ul className="flex flex-col divide-y divide-line rounded-card bg-surface shadow-card">
            {(sent ?? []).map((b) => (
              <li key={b.id}>
                <Link href={b.channel === "whatsapp" ? `/messages/${b.id}` : "#"} className="flex min-h-14 items-center gap-3 px-4 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{b.title}</span>
                    <span className="block text-sm text-muted">
                      {when.format(new Date(b.created_at))} · {b.recipient_count} destinataire{b.recipient_count > 1 ? "s" : ""} ·{" "}
                      {b.channel === "whatsapp" ? "WhatsApp" : "dans l'appli"}
                    </span>
                  </span>
                  {b.channel === "whatsapp" && <ChevronRight aria-hidden className="size-5 text-muted" />}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
