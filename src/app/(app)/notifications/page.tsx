import type { Metadata } from "next";
import Link from "next/link";
import { Bell, BellRing, CakeSlice, CalendarClock, ChevronRight, Megaphone } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { MarkRead } from "@/components/layout/MarkRead";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Notifications" };

const ICONS = { alert: BellRing, birthday: CakeSlice, message: Megaphone, appointment: CalendarClock, info: Bell };
const when = new Intl.DateTimeFormat("fr-CI", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, title, body, link, kind, created_at, read_at")
    .order("created_at", { ascending: false })
    .limit(60);
  const list = data ?? [];
  const unread = list.filter((n) => !n.read_at).length;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title="Notifications" />
      <MarkRead unread={unread} />
      {list.length === 0 && <p className="rounded-card bg-surface p-4 text-muted">Rien de nouveau pour l&apos;instant.</p>}
      <ul className="flex flex-col gap-2">
        {list.map((n) => {
          const Icon = ICONS[n.kind as keyof typeof ICONS] ?? Bell;
          const content = (
            <>
              <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${n.read_at ? "bg-royal/10 text-royal" : "bg-royal text-white"}`}>
                <Icon aria-hidden className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block ${n.read_at ? "font-medium" : "font-bold"}`}>{n.title}</span>
                {n.body && <span className="block text-sm text-muted">{n.body}</span>}
                <span className="block text-xs text-muted">{when.format(new Date(n.created_at))}</span>
              </span>
              {n.link && <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />}
            </>
          );
          return (
            <li key={n.id}>
              {n.link ? (
                <Link href={n.link} className="flex items-start gap-3 rounded-card bg-surface p-3 shadow-card">
                  {content}
                </Link>
              ) : (
                <div className="flex items-start gap-3 rounded-card bg-surface p-3 shadow-card">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
