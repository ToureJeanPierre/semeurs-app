import Link from "next/link";
import { CalendarCheck, ChevronRight } from "lucide-react";
import { toggleTask } from "@/app/(app)/reunions/actions";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { addDays, formatHour, formatLongDay, formatShortDay, todayIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

/** Mes engagements : services dans mes groupes, réunions sans réponse, tâches à faire. */
export async function MyCommitments({ personId }: { personId: string }) {
  const supabase = await createClient();
  const today = todayIso();
  const [{ data: duties }, { data: invitations }, { data: tasks }] = await Promise.all([
    supabase
      .from("group_duties")
      .select("id, duty_date, label, capability_code, groups(id, name)")
      .eq("person_id", personId)
      .gte("duty_date", today)
      .lte("duty_date", addDays(today, 13))
      .order("duty_date")
      .limit(6),
    supabase
      .from("meeting_invitees")
      .select("meetings!inner(id, title, starts_at, status)")
      .eq("person_id", personId)
      .eq("response", "pending")
      .eq("meetings.status", "planned")
      .gte("meetings.starts_at", today),
    supabase.from("meeting_tasks").select("id, title, due_on, meeting_id").eq("assignee_id", personId).is("done_at", null).order("due_on"),
  ]);
  const d = (duties ?? []) as unknown as { id: string; duty_date: string; label: string; capability_code: string; groups: { id: string; name: string } | null }[];
  const inv = ((invitations ?? []) as unknown as { meetings: { id: string; title: string; starts_at: string } }[]).map((i) => i.meetings);
  const t = (tasks ?? []) as { id: string; title: string; due_on: string | null; meeting_id: string }[];
  if (!d.length && !inv.length && !t.length) return null;

  return (
    <Card className="flex flex-col gap-3 shadow-card">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <CalendarCheck aria-hidden className="size-5 text-royal" /> Mes engagements
      </h2>
      {inv.map((m) => (
        <Link key={m.id} href={`/reunions/${m.id}`} className="flex min-h-12 items-center gap-2 rounded-2xl bg-warn-bg px-3 text-sm text-warn-text">
          <span className="flex-1">
            <span className="font-semibold">Répondre : {m.title}</span> · <span className="first-letter:uppercase">{formatLongDay(m.starts_at)}</span> · {formatHour(m.starts_at)}
          </span>
          <ChevronRight aria-hidden className="size-4 shrink-0" />
        </Link>
      ))}
      {d.length > 0 && (
        <ul className="flex flex-col divide-y divide-line text-sm">
          {d.map((x) => (
            <li key={x.id}>
              <Link href={`/mes-groupes/${x.groups?.id}`} className="flex min-h-12 flex-col justify-center py-1">
                <span>
                  <span className="font-semibold">{formatShortDay(x.duty_date)}</span> · {x.capability_code === "prayer_chain" ? `Prière ${x.label}` : x.label}
                </span>
                <span className="text-muted">{x.groups?.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {t.map((task) => (
        <form key={task.id} action={toggleTask} className="flex items-center gap-2 text-sm">
          <input type="hidden" name="task_id" value={task.id} />
          <input type="hidden" name="done" value="1" />
          <Link href={`/reunions/${task.meeting_id}`} className="flex-1">
            <span className="font-semibold">{task.title}</span>
            {task.due_on ? <span className="text-muted"> · avant le {formatShortDay(task.due_on)}</span> : null}
          </Link>
          <SubmitButton className="min-h-11 rounded-full bg-ok-bg px-3 font-semibold text-ok-text">Fait</SubmitButton>
        </form>
      ))}
    </Card>
  );
}
