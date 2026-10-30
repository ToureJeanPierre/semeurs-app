import Link from "next/link";
import { Bell, CalendarDays, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { addDays, formatHour, formatLongDay, todayIso } from "@/lib/format";
import { expandEvents, type GroupEvent } from "@/lib/group-agenda";
import { createClient } from "@/lib/supabase/server";

/** Mon espace : ce qui arrive dans ma famille et mes équipes (14 jours) et mes dernières nouvelles. */
export async function MyGroupsNews({ personId }: { personId: string }) {
  const supabase = await createClient();
  const today = todayIso();
  const until = addDays(today, 14);
  const [{ data: myGroups }, { data: news }] = await Promise.all([
    supabase.rpc("my_groups"),
    supabase.from("notifications").select("id, title, body, link, created_at, read_at").eq("person_id", personId).order("created_at", { ascending: false }).limit(4),
  ]);
  const groups = (myGroups ?? []) as { id: string; name: string }[];
  const { data: events } = groups.length
    ? await supabase.from("group_events").select("*").in("group_id", groups.map((g) => g.id))
    : { data: [] };
  const coming = expandEvents((events ?? []) as GroupEvent[], today, until)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 5);
  const groupName = (id: string) => groups.find((g) => g.id === id)?.name ?? "";
  if (coming.length === 0 && (news ?? []).length === 0) return null;

  return (
    <Card className="flex flex-col gap-3 shadow-card">
      {coming.length > 0 && (
        <>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <CalendarDays aria-hidden className="size-5 text-royal" /> Dans ma famille et mes équipes
          </h2>
          <ul className="flex flex-col divide-y divide-line">
            {coming.map((o) => (
              <li key={`${o.id}-${o.date}`}>
                <Link href={`/mes-groupes/${(o as unknown as { group_id: string }).group_id}`} className="flex min-h-14 items-center gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{o.title}</span>
                    <span className="block text-sm text-muted first-letter:uppercase">
                      {formatLongDay(o.date)} · {formatHour(o.startsAt)} · {groupName((o as unknown as { group_id: string }).group_id)}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {(news ?? []).length > 0 && (
        <>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Bell aria-hidden className="size-5 text-royal" /> Mes dernières nouvelles
          </h2>
          <ul className="flex flex-col divide-y divide-line">
            {(news ?? []).map((n) => (
              <li key={n.id}>
                <Link href={n.link ?? "/notifications"} className="flex min-h-12 items-start gap-2 py-2">
                  {!n.read_at && <span aria-label="non lue" className="mt-2 size-2 shrink-0 rounded-full bg-alert-ring" />}
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{n.title}</span>
                    {n.body && <span className="block truncate text-sm text-muted">{n.body}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/notifications" className="text-sm font-semibold text-royal">
            Toutes mes notifications →
          </Link>
        </>
      )}
    </Card>
  );
}
