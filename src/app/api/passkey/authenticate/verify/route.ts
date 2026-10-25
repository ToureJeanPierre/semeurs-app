import { NextResponse } from "next/server";
import {
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { getCurrentUser, setDeviceLock, setUnlocked } from "@/lib/auth/session";
import { consumeChallenge, findCredential, relyingParty, touchCredential } from "@/lib/auth/passkeys";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Vérifie l'empreinte / le schéma.
 * - Connecté : déverrouille l'application.
 * - Non connecté : ouvre une session pour le propriétaire de la clé.
 */
export async function POST(request: Request) {
  const expectedChallenge = await consumeChallenge("authenticate");
  if (!expectedChallenge) {
    return NextResponse.json({ error: "La demande a expiré. Réessayez." }, { status: 400 });
  }

  const body = (await request.json()) as { response: AuthenticationResponseJSON };
  const stored = await findCredential(body.response.id);
  if (!stored) {
    return NextResponse.json(
      { error: "Cette clé n'est pas reconnue. Connectez-vous avec votre mot de passe." },
      { status: 400 },
    );
  }

  const { rpID, origin } = relyingParty(request);
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: stored.credential_id,
        publicKey: new Uint8Array(Buffer.from(stored.public_key, "base64url")),
        counter: stored.counter,
        transports: stored.transports ?? undefined,
      },
    });
  } catch {
    return NextResponse.json({ error: "Vérification impossible. Réessayez." }, { status: 400 });
  }
  if (!verification.verified) {
    return NextResponse.json({ error: "Vérification refusée." }, { status: 400 });
  }
  await touchCredential(stored.id, verification.authenticationInfo.newCounter);

  const current = await getCurrentUser();
  if (current) {
    if (current.id !== stored.user_id) {
      return NextResponse.json(
        { error: "Cette clé appartient à un autre compte." },
        { status: 403 },
      );
    }
    await setUnlocked(current.id);
    return NextResponse.json({ ok: true });
  }

  // Connexion sans mot de passe : on fabrique un lien de connexion à usage
  // unique côté serveur (rien n'est envoyé) et on l'utilise aussitôt.
  const admin = createAdminClient();
  const { data: owner, error: ownerError } = await admin.auth.admin.getUserById(stored.user_id);
  if (ownerError || !owner.user?.email) {
    return NextResponse.json({ error: "Compte introuvable." }, { status: 400 });
  }
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: owner.user.email,
  });
  if (linkError || !link.properties?.hashed_token) {
    return NextResponse.json({ error: "Connexion impossible. Réessayez." }, { status: 500 });
  }
  const supabase = await createClient();
  const { error: otpError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (otpError) {
    return NextResponse.json({ error: "Connexion impossible. Réessayez." }, { status: 500 });
  }

  await setDeviceLock(stored.user_id);
  await setUnlocked(stored.user_id);
  return NextResponse.json({ ok: true });
}
