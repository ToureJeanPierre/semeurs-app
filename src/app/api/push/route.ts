import { NextResponse, type NextRequest } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Envoi d'une notification sur les téléphones d'une personne (Web Push).
 * Appelé par la base (déclencheur sur « notifications », extension pg_net) avec le secret
 * PUSH_WEBHOOK_SECRET ; sans lui, refus. Les abonnements périmés sont retirés.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.PUSH_WEBHOOK_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return NextResponse.json({ error: "Clés VAPID absentes." }, { status: 500 });
  webpush.setVapidDetails("mailto:lessemeursdelaparole@gmail.com", publicKey, privateKey);

  const { person_id, title, body, link, tag } = (await request.json()) as { person_id: string; title: string; body: string | null; link: string | null; tag: string | null };
  const admin = createAdminClient();
  const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("person_id", person_id);
  const payload = JSON.stringify({ title, body: body ?? "", link: link ?? "/notifications", tag: tag ?? undefined });
  let sent = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86_400 });
        sent++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
      }
    }),
  );
  return NextResponse.json({ sent });
}
