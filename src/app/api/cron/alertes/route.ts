import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Tâches quotidiennes, appelées par Vercel Cron chaque matin à 6 h (heure d'Abidjan = UTC) :
 * alertes d'absence (docs/02 §6.1), anniversaires, rappels de passage, de réunion, etc.
 * Vercel envoie le secret CRON_SECRET ; sans lui, refus. Chaque calcul est dans la base.
 */
const JOBS = [
  "compute_alerts",
  "notify_birthdays",
  "notify_program_reminders",
  "notify_meeting_reminders",
  "notify_missing_reports",
  "notify_cash_closing",
  "notify_pledge_reminders",
] as const;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const admin = createAdminClient();
  // Une tâche en échec n'empêche pas les autres.
  const results = await Promise.all(JOBS.map((job) => admin.rpc(job)));
  const report = Object.fromEntries(JOBS.map((job, i) => [job, results[i].error ? `erreur : ${results[i].error!.message}` : results[i].data]));
  const failed = results.some((r) => r.error);
  return NextResponse.json(report, { status: failed ? 500 : 200 });
}
