"use client";

import {
  WebAuthnAbortService,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";

/** Le téléphone sait-il utiliser l'empreinte / le schéma pour ce site ? */
export async function canUsePasskeys(): Promise<boolean> {
  if (!browserSupportsWebAuthn()) return false;
  try {
    return await platformAuthenticatorIsAvailable();
  } catch {
    return false;
  }
}

async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Une erreur est survenue. Réessayez.");
  return data;
}

function friendly(error: unknown): Error {
  if (error instanceof Error) {
    if (error.name === "NotAllowedError" || error.name === "AbortError") {
      return new Error("Opération annulée. Vous pouvez réessayer.");
    }
    if (error.name === "InvalidStateError") {
      return new Error("Ce téléphone est déjà autorisé à ouvrir votre compte.");
    }
    return error;
  }
  return new Error("Une erreur est survenue. Réessayez.");
}

/** Active l'empreinte / le schéma pour le compte connecté, sur ce téléphone. */
export async function registerPasskey() {
  try {
    const optionsJSON = await postJson("/api/passkey/register/options");
    const response = await startRegistration({ optionsJSON });
    await postJson("/api/passkey/register/verify", { response });
  } catch (error) {
    throw friendly(error);
  }
}

/** Connexion ou déverrouillage par empreinte / schéma. */
export async function authenticateWithPasskey() {
  try {
    WebAuthnAbortService.cancelCeremony();
    const optionsJSON = await postJson("/api/passkey/authenticate/options");
    const response = await startAuthentication({ optionsJSON });
    await postJson("/api/passkey/authenticate/verify", { response });
  } catch (error) {
    throw friendly(error);
  }
}
