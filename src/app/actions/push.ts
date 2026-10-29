"use server";

import { createClient } from "@/lib/supabase/server";

type Subscription = { endpoint: string; keys: { p256dh: string; auth: string } };

/** Enregistre ce téléphone pour recevoir les notifications (RLS : seulement pour soi). */
export async function savePushSubscription(sub: Subscription, userAgent: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("my_access");
  const personId = (me as { person_id?: string } | null)?.person_id;
  if (!personId || !sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return false;
  const { error } = await supabase.from("push_subscriptions").upsert(
    { person_id: personId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_agent: userAgent.slice(0, 200) },
    { onConflict: "endpoint" },
  );
  return !error;
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}
