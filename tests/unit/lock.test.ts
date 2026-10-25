import { describe, expect, it } from "vitest";
import {
  isUnlocked,
  matchesPath,
  readChallenge,
  signChallenge,
  signUnlockToken,
  PUBLIC_PATHS,
} from "@/lib/auth/lock";

const SECRET = "x".repeat(40);
const OTHER_SECRET = "y".repeat(40);
const USER = "11111111-1111-1111-1111-111111111111";

describe("jeton de déverrouillage", () => {
  it("est valide pour la bonne personne", async () => {
    const token = await signUnlockToken(USER, SECRET, 30);
    expect(await isUnlocked(token, USER, SECRET)).toBe(true);
  });

  it("est refusé pour une autre personne", async () => {
    const token = await signUnlockToken(USER, SECRET, 30);
    expect(await isUnlocked(token, "22222222-2222-2222-2222-222222222222", SECRET)).toBe(false);
  });

  it("est refusé s'il est signé avec une autre clé (falsification)", async () => {
    const token = await signUnlockToken(USER, OTHER_SECRET, 30);
    expect(await isUnlocked(token, USER, SECRET)).toBe(false);
  });

  it("est refusé une fois expiré", async () => {
    const token = await signUnlockToken(USER, SECRET, 1 / 60); // 1 seconde
    await new Promise((r) => setTimeout(r, 2100));
    expect(await isUnlocked(token, USER, SECRET)).toBe(false);
  });

  it("est refusé s'il est absent ou illisible", async () => {
    expect(await isUnlocked(undefined, USER, SECRET)).toBe(false);
    expect(await isUnlocked("n'importe quoi", USER, SECRET)).toBe(false);
  });
});

describe("défi WebAuthn", () => {
  it("ne sert qu'à l'usage prévu", async () => {
    const token = await signChallenge("abc", "register", SECRET);
    expect(await readChallenge(token, "register", SECRET)).toBe("abc");
    expect(await readChallenge(token, "authenticate", SECRET)).toBeNull();
    expect(await readChallenge(token, "register", OTHER_SECRET)).toBeNull();
  });
});

describe("chemins publics", () => {
  it("reconnaît les chemins et leurs sous-chemins", () => {
    expect(matchesPath("/connexion", PUBLIC_PATHS)).toBe(true);
    expect(matchesPath("/api/passkey/authenticate/options", PUBLIC_PATHS)).toBe(true);
    expect(matchesPath("/connexions-secretes", PUBLIC_PATHS)).toBe(false);
    expect(matchesPath("/api/passkey/register/options", PUBLIC_PATHS)).toBe(false);
    expect(matchesPath("/", PUBLIC_PATHS)).toBe(false);
  });
});
