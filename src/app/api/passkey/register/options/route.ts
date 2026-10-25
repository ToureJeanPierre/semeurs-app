import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { getCurrentUser } from "@/lib/auth/session";
import { RP_NAME, listCredentialIds, relyingParty, storeChallenge } from "@/lib/auth/passkeys";
import { formatPhone } from "@/lib/phone";

/** Étape 1 de l'activation : le serveur prépare la demande au téléphone. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { rpID, secure } = relyingParty(request);
  const existing = await listCredentialIds(user.id);
  const displayName = user.phone ? formatPhone(user.phone) : "Membre";

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userID: new TextEncoder().encode(user.id),
    userName: displayName,
    userDisplayName: displayName,
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({
      id: c.credential_id,
      transports: c.transports ?? undefined,
    })),
    authenticatorSelection: {
      // Clé gardée dans le téléphone, déverrouillée par empreinte / schéma / code.
      residentKey: "required",
      userVerification: "required",
      authenticatorAttachment: "platform",
    },
  });

  await storeChallenge(options.challenge, "register", secure);
  return NextResponse.json(options);
}
