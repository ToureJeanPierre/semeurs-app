import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Video } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
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

  const card = (m: Row) => {
    const mine = m.meeting_invitees.find((i) => i.person_id === access.personId);
    return (
      <Link key={m.id} href={`/reunions/${m.id}`} className="flex items-center gap-3 rounded-card bg-surface p-4 shadow-card active:scale-[0.99]">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-royal/10 text-royal">
          <Video aria-hidden className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{m.title}</span>
          <span className="block text-sm text-muted first-letter:uppercase">
            {formatLongDay(m.starts_at)} · {formatHour(m.starts_at)} · {MODE_LABEL[m.mode]}
          </span>
          <span className="mt-1 flex flex-wrap gap-1 text-xs font-semibold">
            {m.status !== "planned" && <span className="rounded-full bg-cloud px-2 py-0.5">{STATUS_LABEL[m.status]}</span>}
            {m.organizer_id === access.personId ? (
              <span className="rounded-full bg-gold/30 px-2 py-0.5 text-night">J&apos;organise</span>
            ) : mine ? (
              <span className={`rounded-full px-2 py-0.5 ${mine.response === "pending" ? "bg-warn-bg text-warn-text" : "bg-ok-bg text-ok-text"}`}>
                {RESPONSE_LABEL[mine.response]}
              </span>
            ) : null}
          </span>
        </span>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
      </Link>
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
