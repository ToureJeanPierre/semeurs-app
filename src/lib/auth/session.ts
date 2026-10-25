import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authEmailToPhone, type IvorianPhone } from "@/lib/phone";
import { serverEnv } from "@/lib/env";
import {
  DEVICE_LOCK_COOKIE,
  UNLOCK_COOKIE,
  baseCookieOptions,
  deviceLockCookieMaxAge,
  signUnlockToken,
} from "@/lib/auth/lock";

export type CurrentUser = {
  id: string;
  phone: IvorianPhone | null;
};

/** Personne connectée, ou null. Le jeton est vérifié (getClaims). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, phone: authEmailToPhone(claims.email as string | undefined) };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  return user;
}

async function isSecureRequest() {
  const h = await headers();
  return (h.get("x-forwarded-proto") ?? "http") === "https";
}

/** Marque l'application comme déverrouillée pour la durée d'inactivité permise. */
export async function setUnlocked(userId: string) {
  const store = await cookies();
  const idle = serverEnv.appLockIdleMinutes;
  store.set(UNLOCK_COOKIE, await signUnlockToken(userId, serverEnv.appLockSecret, idle), {
    ...baseCookieOptions(await isSecureRequest()),
    maxAge: Math.round(idle * 60),
  });
}

/** Active le verrou par clé d'accès sur cet appareil. */
export async function setDeviceLock(userId: string) {
  const store = await cookies();
  store.set(DEVICE_LOCK_COOKIE, userId, {
    ...baseCookieOptions(await isSecureRequest()),
    maxAge: deviceLockCookieMaxAge,
  });
}

export async function clearDeviceLock() {
  (await cookies()).delete(DEVICE_LOCK_COOKIE);
}

export async function isDeviceLockedFor(userId: string) {
  return (await cookies()).get(DEVICE_LOCK_COOKIE)?.value === userId;
}

export async function clearUnlock() {
  (await cookies()).delete(UNLOCK_COOKIE);
}
