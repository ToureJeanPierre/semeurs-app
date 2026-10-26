import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  DEVICE_LOCK_COOKIE,
  LOCKED_ALLOWED_PATHS,
  PUBLIC_PATHS,
  UNLOCK_COOKIE,
  baseCookieOptions,
  isUnlocked,
  matchesPath,
  signUnlockToken,
} from "@/lib/auth/lock";
import { publicEnv, serverEnv } from "@/lib/env";

/**
 * Avant chaque page :
 * 1. rafraîchit la session Supabase ;
 * 2. renvoie vers /connexion si personne n'est connecté ;
 * 3. renvoie vers /deverrouiller si l'appareil est verrouillé par clé d'accès
 *    et que le dernier déverrouillage est trop ancien.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    publicEnv.supabaseUrl,
    publicEnv.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    },
  );

  // getClaims() vérifie la signature du jeton : on peut s'y fier.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const { pathname } = request.nextUrl;

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    // Conserver les cookies de session éventuellement rafraîchis.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!userId) {
    if (matchesPath(pathname, PUBLIC_PATHS)) return response;
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Non connecté." }, { status: 401 });
    }
    return redirectTo("/connexion");
  }

  if (pathname === "/connexion") return redirectTo("/");

  const deviceLockedFor = request.cookies.get(DEVICE_LOCK_COOKIE)?.value;
  if (deviceLockedFor !== userId) return response;

  const secret = serverEnv.appLockSecret;
  const unlocked = await isUnlocked(request.cookies.get(UNLOCK_COOKIE)?.value, userId, secret);

  if (!unlocked) {
    if (matchesPath(pathname, LOCKED_ALLOWED_PATHS)) return response;
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Application verrouillée." }, { status: 423 });
    }
    return redirectTo("/deverrouiller");
  }

  if (pathname === "/deverrouiller") return redirectTo("/");

  // Inactivité glissante : chaque visite prolonge le déverrouillage.
  const idle = serverEnv.appLockIdleMinutes;
  response.cookies.set(UNLOCK_COOKIE, await signUnlockToken(userId, secret, idle), {
    ...baseCookieOptions(request.nextUrl.protocol === "https:"),
    maxAge: Math.round(idle * 60),
  });
  return response;
}

export const config = {
  matcher: [
    // Tout sauf les fichiers statiques, les icônes, le manifeste et le service worker.
    "/((?!_next/static|_next/image|icons/|images/|logo|favicon.ico|manifest.webmanifest|sw.js|robots.txt).*)",
  ],
};
