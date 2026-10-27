import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Calcul quotidien des alertes d'absence (docs/02 §6.1), appelé par Vercel Cron
 * chaque matin à 6 h (heure d'Abidjan = UTC). Vercel envoie le secret CRON_SECRET ;
 * sans lui, refus. Le calcul lui-même est dans la base (compute_alerts).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const admin = createAdminClient();
  const [alerts, birthdays] = await Promise.all([
    admin.rpc("compute_alerts"),
    admin.rpc("notify_birthdays"),
  ]);
  if (alerts.error || birthdays.error) {
    return NextResponse.json({ error: alerts.error?.message ?? birthdays.error?.message }, { status: 500 });
  }
  return NextResponse.json({ changed: alerts.data, birthdays: birthdays.data });
}
