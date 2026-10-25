import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listCredentialIds, relyingParty, storeChallenge } from "@/lib/auth/passkeys";

/**
 * Prépare une demande d'empreinte / schéma.
 * - Connecté (déverrouillage) : on limite aux clés de cette personne.
 * - Non connecté (connexion) : le téléphone propose les clés qu'il connaît.
 */
export async function POST(request: Request) {
  const { rpID, secure } = relyingParty(request);
  const user = await getCurrentUser();
  const allowCredentials = user
    ? (await listCredentialIds(user.id)).map((c) => ({
        id: c.credential_id,
        transports: c.transports ?? undefined,
      }))
    : undefined;

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
    userVerification: "required",
  });

  await storeChallenge(options.challenge, "authenticate", secure);
  return NextResponse.json(options);
}
