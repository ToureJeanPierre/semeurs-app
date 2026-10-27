/**
 * Verrou de l'application (empreinte, schéma ou code du téléphone).
 *
 * - La session Supabase dit QUI est connecté (longue durée).
 * - Sur un appareil où la personne a activé sa clé d'accès, le cookie
 *   DEVICE_LOCK_COOKIE indique qu'il faut aussi un déverrouillage récent.
 * - UNLOCK_COOKIE contient un jeton signé, valable quelques minutes,
 *   prolongé à chaque visite : au-delà de l'inactivité permise, l'appli
 *   redemande l'empreinte ou le schéma.
 */
import { SignJWT, jwtVerify } from "jose";

export const DEVICE_LOCK_COOKIE = "sm_device_lock";
export const UNLOCK_COOKIE = "sm_unlock";
export const WEBAUTHN_CHALLENGE_COOKIE = "sm_webauthn";

const ISSUER = "semeurs-app";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function key(secret: string) {
  return new TextEncoder().encode(secret);
}

export function baseCookieOptions(secure: boolean) {
  return { httpOnly: true, secure, sameSite: "lax" as const, path: "/" };
}

export const deviceLockCookieMaxAge = ONE_YEAR_SECONDS;

export async function signUnlockToken(
  userId: string,
  secret: string,
  idleMinutes: number,
): Promise<string> {
  return new SignJWT({ purpose: "unlock" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${Math.round(idleMinutes * 60)}s`)
    .sign(key(secret));
}

/** Vrai si le jeton est valide, non expiré et appartient bien à cette personne. */
export async function isUnlocked(
  token: string | undefined,
  userId: string,
  secret: string,
): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, key(secret), { issuer: ISSUER });
    return payload.sub === userId && payload.purpose === "unlock";
  } catch {
    return false;
  }
}

export type ChallengePurpose = "register" | "authenticate";

export async function signChallenge(
  challenge: string,
  purpose: ChallengePurpose,
  secret: string,
): Promise<string> {
  return new SignJWT({ challenge, purpose })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key(secret));
}

export async function readChallenge(
  token: string | undefined,
  purpose: ChallengePurpose,
  secret: string,
): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { issuer: ISSUER });
    if (payload.purpose !== purpose || typeof payload.challenge !== "string") return null;
    return payload.challenge;
  } catch {
    return null;
  }
}

/**
 * Chemins accessibles sans être connecté. Tout le reste exige une session.
 */
// /api/cron : protégé par son propre secret (CRON_SECRET) ; /p : liens publics à jeton (position du domicile).
export const PUBLIC_PATHS = ["/connexion", "/hors-ligne", "/api/passkey/authenticate", "/api/cron", "/api/position", "/p"];

/** Chemins accessibles connecté mais verrouillé. */
export const LOCKED_ALLOWED_PATHS = ["/deverrouiller", "/api/passkey/authenticate"];

export function matchesPath(pathname: string, paths: string[]): boolean {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
