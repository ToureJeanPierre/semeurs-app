import { randomInt } from "node:crypto";

// Sans lettres ni chiffres ambigus (l/1, o/0) : facile à dicter au téléphone.
const CONSONANTS = "bcdfghjkmnprstvz";
const VOWELS = "aeiu";

/**
 * Mot de passe de départ remis au fidèle, ex. « kabume-4827 » : trois syllabes
 * faciles à lire à voix haute et quatre chiffres. Le fidèle le change ensuite
 * dans son Profil.
 */
export function generateStarterPassword(): string {
  let word = "";
  for (let i = 0; i < 3; i++) {
    word += CONSONANTS[randomInt(CONSONANTS.length)] + VOWELS[randomInt(VOWELS.length)];
  }
  const digits = String(randomInt(2000, 10000));
  return `${word}-${digits}`;
}
