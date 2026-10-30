import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { ActionForm } from "@/components/people/ActionForm";
import { Card } from "@/components/ui/Card";
import { requirePermission } from "@/lib/access";
import { formatTime } from "@/lib/services";
import { createClient } from "@/lib/supabase/server";
import { openServiceSession } from "./actions";

export const metadata: Metadata = { title: "Pointage" };

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const dayFormat = new Intl.DateTimeFormat("fr-CI", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export default async function AttendancePage() {
  await requirePermission("attendance.record");
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10); // Abidjan = UTC
  const [{ data: types }, { data: sessions }] = await Promise.all([
    supabase.from("service_types").select("id, name, short_name, weekday, start_time, end_time").order("weekday"),
    supabase.from("sessions").select("id, title, session_date, attendance(count)").order("session_date", { ascending: false }).limit(12),
  ]);
  const todayWeekday = new Date().getUTCDay();
  const sorted = [...(types ?? [])].sort((a, b) => Number(b.weekday === todayWeekday) - Number(a.weekday === todayWeekday));

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pb-8 pt-5">
      <PageTitle
        title="Pointage"
        intro="Ouvrez la liste du culte avant qu'il commence : elle continue de fonctionner si le réseau coupe."
      />
      <Card className="shadow-card">
        <h2 className="mb-3 text-lg font-semibold">Ouvrir le pointage</h2>
        <ActionForm action={openServiceSession} submitLabel="Ouvrir la liste" variant="primary">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Culte</span>
            <select name="service_type_id" defaultValue={sorted[0]?.id} className="min-h-13 rounded-2xl border-2 border-[#c9daf6] bg-[#f4f8ff] px-3 text-base focus:border-royal focus:bg-white focus:ring-4 focus:ring-royal/10">
              {sorted.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.short_name ?? t.name} — {WEEKDAYS[t.weekday]} {formatTime(t.start_time)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Date</span>
            <input type="date" name="session_date" defaultValue={today} max={today} className="min-h-13 rounded-2xl border-2 border-[#c9daf6] bg-[#f4f8ff] px-3 text-base focus:border-royal focus:bg-white focus:ring-4 focus:ring-royal/10" />
          </label>
        </ActionForm>
      </Card>

      {(sessions ?? []).length > 0 && (
        <section aria-labelledby="recents">
          <h2 id="recents" className="mb-2 text-lg font-semibold">Derniers pointages</h2>
          <ul className="flex flex-col divide-y divide-line rounded-card bg-surface shadow-card">
            {(sessions ?? []).map((s) => {
              const count = (s.attendance as unknown as { count: number }[])[0]?.count ?? 0;
              return (
                <li key={s.id}>
                  <Link href={`/pointage/${s.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{s.title}</span>
                      <span className="block text-sm text-muted">
                        {dayFormat.format(new Date(s.session_date))} · {count} présent{count > 1 ? "s" : ""}
                      </span>
                    </span>
                    <ChevronRight aria-hidden className="size-5 text-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
