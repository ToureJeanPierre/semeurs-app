export type DailyVerse = {
  id: string;
  reference: string;
  text: string;
  translation: string;
  position: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Verset du jour : les versets actifs tournent dans l'ordre de `position`,
 * un par jour (minuit à Abidjan = minuit UTC). Tout le monde voit le même.
 */
export function pickDailyVerse(verses: DailyVerse[], now: Date): DailyVerse | null {
  if (verses.length === 0) return null;
  const sorted = [...verses].sort((a, b) => a.position - b.position);
  const dayNumber = Math.floor(now.getTime() / DAY_MS);
  return sorted[dayNumber % sorted.length];
}
