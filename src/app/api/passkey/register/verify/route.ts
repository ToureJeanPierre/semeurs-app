import { NextResponse } from "next/server";
import { verifyRegistrationResponse, type RegistrationResponseJSON } from "@simplewebauthn/server";
import { getCurrentUser, setDeviceLock, setUnlocked } from "@/lib/auth/session";
import {
  consumeChallenge,
  deviceLabelFrom,
  insertCredential,
  relyingParty,
} from "@/lib/auth/passkeys";

/** Étape 2 de l'activation : on vérifie la réponse du téléphone et on garde la clé publique. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const expectedChallenge = await consumeChallenge("register");
  if (!expectedChallenge) {
    return NextResponse.json(
      { error: "La demande a expiré. Recommencez l'activation." },
      { status: 400 },
    );
  }

  const { rpID, origin } = relyingParty(request);
  const body = (await request.json()) as { response: RegistrationResponseJSON };

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch {
    return NextResponse.json({ error: "Vérification impossible. Réessayez." }, { status: 400 });
  }

  if (!verification.verified) {
    return NextResponse.json({ error: "Vérification refusée." }, { status: 400 });
  }

  const { credential } = verification.registrationInfo;
  await insertCredential({
    userId: user.id,
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    transports: credential.transports,
    deviceLabel: deviceLabelFrom(request.headers.get("user-agent")),
  });

  await setDeviceLock(user.id);
  await setUnlocked(user.id);
  return NextResponse.json({ ok: true });
}
