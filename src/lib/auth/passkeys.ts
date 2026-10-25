import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import {
  WEBAUTHN_CHALLENGE_COOKIE,
  baseCookieOptions,
  readChallenge,
  signChallenge,
  type ChallengePurpose,
} from "@/lib/auth/lock";

export const RP_NAME = "Les Semeurs de la Parole";

/**
 * La clé d'accès est liée au nom de domaine (ex. semeurs-app.vercel.app).
 * On le déduit de la requête : chaque adresse (production, prévisualisation,
 * poste local) a ses propres clés.
 */
export function relyingParty(request: Request) {
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") ?? url.host;
  const origin = `${proto}://${host}`;
  return { rpID: new URL(origin).hostname, origin, secure: proto === "https" };
}

export async function storeChallenge(
  challenge: string,
  purpose: ChallengePurpose,
  secure: boolean,
) {
  (await cookies()).set(
    WEBAUTHN_CHALLENGE_COOKIE,
    await signChallenge(challenge, purpose, serverEnv.appLockSecret),
    { ...baseCookieOptions(secure), maxAge: 300 },
  );
}

/** Lit puis efface le défi : il ne peut servir qu'une fois. */
export async function consumeChallenge(purpose: ChallengePurpose) {
  const store = await cookies();
  const token = store.get(WEBAUTHN_CHALLENGE_COOKIE)?.value;
  store.delete(WEBAUTHN_CHALLENGE_COOKIE);
  return readChallenge(token, purpose, serverEnv.appLockSecret);
}

export type StoredCredential = {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  transports: string[] | null;
};

export async function listCredentialIds(userId: string) {
  const { data, error } = await createAdminClient()
    .from("webauthn_credentials")
    .select("credential_id, transports")
    .eq("user_id", userId);
  if (error) throw error;
  return data as { credential_id: string; transports: string[] | null }[];
}

export async function findCredential(credentialId: string) {
  const { data, error } = await createAdminClient()
    .from("webauthn_credentials")
    .select("id, user_id, credential_id, public_key, counter, transports")
    .eq("credential_id", credentialId)
    .maybeSingle();
  if (error) throw error;
  return data as StoredCredential | null;
}

export async function insertCredential(input: {
  userId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports?: string[];
  deviceLabel: string;
}) {
  const { error } = await createAdminClient().from("webauthn_credentials").insert({
    user_id: input.userId,
    credential_id: input.credentialId,
    public_key: input.publicKey,
    counter: input.counter,
    transports: input.transports ?? null,
    device_label: input.deviceLabel,
  });
  if (error) throw error;
}

export async function touchCredential(id: string, counter: number) {
  const { error } = await createAdminClient()
    .from("webauthn_credentials")
    .update({ counter, last_used_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Libellé lisible de l'appareil, à partir du navigateur. */
export function deviceLabelFrom(userAgent: string | null): string {
  const ua = userAgent ?? "";
  const android = ua.match(/Android [\d.]+;\s*([^;)]+)/);
  if (android) return `Android · ${android[1].replace(/ Build.*$/, "").trim()}`;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Windows/.test(ua)) return "Ordinateur Windows";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Linux/.test(ua)) return "Ordinateur Linux";
  return "Appareil";
}
