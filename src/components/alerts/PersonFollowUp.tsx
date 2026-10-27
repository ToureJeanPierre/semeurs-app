import { CalendarX2, Lock, MessageSquareText } from "lucide-react";
import { toggleManualPresence } from "@/app/(app)/fideles/actions";
import { AbsenceForm } from "@/components/people/AbsenceForm";
import { EditToggle } from "@/components/people/EditToggle";
import { Card } from "@/components/ui/Card";
import { VigilanceAvatar, type VigilanceLevel } from "@/components/ui/VigilanceAvatar";
import { personName } from "@/lib/admin";
import { loadValueList } from "@/lib/people";
import { createClient } from "@/lib/supabase/server";
import { FollowUpForm } from "./FollowUpForm";

const LABELS: Record<VigilanceLevel, string> = {
  ok: "À jour",
  attention: "Attention",
  urgent: "Urgent",
  critical: "Critique",
  lost: "Perdu de vue",
  excused: "Absence justifiée",
};
const day = new Intl.DateTimeFormat("fr-CI", { day: "numeric", month: "short", timeZone: "UTC" });
const full = new Intl.DateTimeFormat("fr-CI", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/**
 * Suivi d'un fidèle sur sa fiche (docs/03 §5.2) : état d'assiduité, frise des
 * 8 derniers cultes, journal de suivi, « Noter un contact », absence justifiée.
 */
export async function PersonFollowUp({
  personId,
  name,
  canManage,
}: {
  personId: string;
  name: string;
  canManage: boolean;
}) {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: canFollow }, { data: alert }, { data: sessions }, { data: followUps }, channels, results, reasons, { data: absences }] =
    await Promise.all([
      supabase.rpc("can_follow_person", { target: personId }),
      supabase.from("alerts").select("level, days_absent, last_presence_on, status").eq("person_id", personId).maybeSingle(),
      supabase
        .from("sessions")
        .select("id, title, session_date, attendance(person_id)")
        .eq("counts_for_alerts", true)
        .lte("session_date", today)
        .eq("attendance.person_id", personId)
        .order("session_date", { ascending: false })
        .limit(8),
      supabase
        .from("follow_ups")
        .select("id, channel, result, note, confidential, next_action_on, created_at, author:people!follow_ups_author_id_fkey(first_name, last_name)")
        .eq("person_id", personId)
        .order("created_at", { ascending: false })
        .limit(20),
      loadValueList("contact_channel"),
      loadValueList("contact_result"),
      loadValueList("absence_reason"),
      supabase.from("excused_absences").select("id, starts_on, ends_on, reason").eq("person_id", personId).gte("ends_on", today),
    ]);
  if (!canFollow) return null;

  const level = (alert?.level ?? "ok") as VigilanceLevel;
  const dots = [...(sessions ?? [])].reverse();
  const label = (list: { value: string; label: string }[], v: string) => list.find((o) => o.value === v)?.label ?? v;

  return (
    <section aria-labelledby="suivi" className="flex flex-col gap-3">
      <h2 id="suivi" className="text-lg font-semibold">Suivi</h2>
      <Card className="flex flex-col gap-4 shadow-card">
        <div className="flex items-center gap-4">
          <VigilanceAvatar name={name} level={level} size={56} />
          <div>
            <p className="font-display text-lg font-semibold">{LABELS[level]}</p>
            <p className="text-sm text-muted">
              {alert?.last_presence_on ? `Dernière présence : ${full.format(new Date(alert.last_presence_on))}` : "Aucune présence pointée"}
              {alert && alert.days_absent > 0 ? ` · ${alert.days_absent} jours` : ""}
            </p>
          </div>
        </div>

        {dots.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold">Derniers cultes</p>
            <ol className="flex flex-wrap gap-2">
              {dots.map((s) => {
                const present = (s.attendance as unknown as unknown[]).length > 0;
                const dot = (
                  <span
                    className={`grid size-11 place-items-center rounded-full border-2 text-[0.6875rem] font-semibold ${
                      present ? "border-ok-ring bg-ok-ring text-white" : "border-line bg-surface text-muted"
                    }`}
                  >
                    {day.format(new Date(s.session_date)).replace(".", "")}
                  </span>
                );
                return (
                  <li key={s.id} title={`${s.title} : ${present ? "présent(e)" : "absent(e)"}`}>
                    <span className="sr-only">
                      {s.title} du {full.format(new Date(s.session_date))} : {present ? "présent(e)" : "absent(e)"}
                    </span>
                    {canManage ? (
                      <form action={toggleManualPresence}>
                        <input type="hidden" name="person_id" value={personId} />
                        <input type="hidden" name="session_id" value={s.id} />
                        <input type="hidden" name="present" value={present ? "1" : "0"} />
                        <button type="submit" aria-label={present ? "Annuler la présence pointée après coup" : "Pointer présent(e) après coup"}>
                          {dot}
                        </button>
                      </form>
                    ) : (
                      dot
                    )}
                  </li>
                );
              })}
            </ol>
            {canManage && <p className="mt-1 text-xs text-muted">Touchez un rond pour pointer une présence oubliée.</p>}
          </div>
        )}

        {(absences ?? []).length > 0 && (
          <p className="flex items-center gap-2 rounded-xl bg-royal/5 px-3 py-2 text-sm">
            <CalendarX2 aria-hidden className="size-4 shrink-0 text-royal" />
            {(absences ?? [])
              .map((a) => `${label(reasons, a.reason)} du ${day.format(new Date(a.starts_on))} au ${day.format(new Date(a.ends_on))}`)
              .join(" ; ")}
          </p>
        )}

        <EditToggle label="Noter un contact">
          <FollowUpForm personId={personId} channels={channels} results={results} />
        </EditToggle>
        {canManage && (
          <EditToggle label="Déclarer une absence justifiée">
            <AbsenceForm reasons={reasons} personId={personId} />
          </EditToggle>
        )}
      </Card>

      {(followUps ?? []).length > 0 && (
        <ol className="flex flex-col gap-2 border-l-2 border-royal/20 pl-4">
          {(followUps ?? []).map((f) => {
            const author = f.author as unknown as { first_name: string; last_name: string } | null;
            return (
              <li key={f.id} className="relative rounded-card bg-surface p-3 shadow-card">
                <span aria-hidden className="absolute -left-[1.4rem] top-4 size-3 rounded-full bg-royal" />
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <MessageSquareText aria-hidden className="size-4 text-royal" />
                  {label(channels, f.channel)} · {label(results, f.result)}
                  {f.confidential && <Lock aria-label="Note sensible" className="size-4 text-muted" />}
                </p>
                {f.note && <p className="mt-1">{f.note}</p>}
                <p className="mt-1 text-xs text-muted">
                  {full.format(new Date(f.created_at))}
                  {author ? ` · ${personName(author)}` : ""}
                  {f.next_action_on ? ` · à recontacter le ${day.format(new Date(f.next_action_on))}` : ""}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
