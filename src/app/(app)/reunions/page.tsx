import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { ListItem } from "@/components/ui/ListItem";
import { moduleImage } from "@/lib/navigation";
import { MODE_LABEL, RESPONSE_LABEL, STATUS_LABEL } from "@/components/meetings/meeting-labels";
import { getAccess, hasAny } from "@/lib/access";
import { addDays, formatHour, formatLongDay, todayIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Réunions" };

type Row = {
  id: string;
  title: string;
  starts_at: string;
  mode: string;
  place: string | null;
  status: string;
  organizer_id: string;
  meeting_invitees: { person_id: string; response: string }[];
};

/** Mes réunions : à venir (avec ma réponse) et passées (comptes rendus). */
export default async function MeetingsPage() {
  const access = await getAccess();
  const supabase = await createClient();
  const today = todayIso();
  const since = addDays(today, -60);
  const { data } = await supabase
    .from("meetings")
    .select("id, title, starts_at, mode, place, status, organizer_id, meeting_invitees(person_id, response)")
    .gte("starts_at", since)
    .order("starts_at");
  const rows = (data ?? []) as Row[];
  const upcoming = rows.filter((m) => m.starts_at >= today && m.status === "planned");
  const past = rows.filter((m) => !upcoming.includes(m)).reverse();
  const canCreate = hasAny(access, ["meetings.manage"], "any");
  const art = await moduleImage("meetings");

  const card = (m: Row) => {
    const mine = m.meeting_invitees.find((i) => i.person_id === access.personId);
    return (
      <ListItem
        key={m.id}
        href={`/reunions/${m.id}`}
        title={m.title}
        tone="violet"
        image={art}
        icon="video"
        badge={m.organizer_id === access.personId ? "J'organise" : mine ? RESPONSE_LABEL[mine.response] : m.status !== "planned" ? STATUS_LABEL[m.status] : undefined}
        meta={[
          { icon: "clock", text: `${formatLongDay(m.starts_at)} · ${formatHour(m.starts_at)}` },
          { icon: "place", text: m.mode === "online" ? MODE_LABEL[m.mode] : [MODE_LABEL[m.mode], m.place].filter(Boolean).join(" · ") },
        ]}
      />
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title="Réunions" intro="Sur place ou en ligne (gratuit), avec compte rendu et tâches." />
      {canCreate && (
        <Link href="/reunions/nouvelle" className="flex min-h-14 items-center justify-center gap-2 rounded-card bg-royal font-semibold text-white shadow-card">
          <Plus aria-hidden className="size-5" /> Organiser une réunion
        </Link>
      )}
      <h2 className="text-lg font-semibold">À venir</h2>
      {upcoming.length === 0 && <p className="rounded-card bg-surface p-4 text-muted">Aucune réunion prévue.</p>}
      {upcoming.map(card)}
      {past.length > 0 && <h2 className="text-lg font-semibold">Passées</h2>}
      {past.map(card)}
    </div>
  );
}
