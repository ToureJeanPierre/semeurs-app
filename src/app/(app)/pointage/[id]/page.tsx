import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AttendanceBoard, type RosterRow } from "@/components/attendance/AttendanceBoard";
import { requirePermission } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pointage" };

const dayFormat = new Intl.DateTimeFormat("fr-CI", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export default async function SessionPage({ params }: PageProps<"/pointage/[id]">) {
  await requirePermission("attendance.record");
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: session }, { data: roster }] = await Promise.all([
    supabase.from("sessions").select("id, title, session_date").eq("id", id).maybeSingle(),
    supabase.rpc("attendance_roster", { p_session: id }),
  ]);
  if (!session) notFound();

  return (
    <AttendanceBoard
      sessionId={session.id}
      title={session.title}
      dateLabel={dayFormat.format(new Date(session.session_date))}
      roster={(roster ?? []) as RosterRow[]}
    />
  );
}
