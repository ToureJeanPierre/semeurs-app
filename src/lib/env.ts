/**
 * Lecture centralisée des variables d'environnement.
 * Les valeurs se collent dans Vercel → Settings → Environment Variables
 * (voir docs/guide-mise-en-place.md).
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. Voir docs/guide-mise-en-place.md.`,
    );
  }
  return value;
}

// Les variables NEXT_PUBLIC_ doivent être lues littéralement pour être
// intégrées au code envoyé au navigateur.
export const publicEnv = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabasePublishableKey() {
    return required(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
  },
};

export const serverEnv = {
  get supabaseSecretKey() {
    return required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY);
  },
  get appLockSecret() {
    const secret = required("APP_LOCK_SECRET", process.env.APP_LOCK_SECRET);
    if (secret.length < 32) {
      throw new Error("APP_LOCK_SECRET doit contenir au moins 32 caractères.");
    }
    return secret;
  },
  /**
   * Minutes d'inactivité avant de redemander l'empreinte ou le schéma.
   * Provisoire : passera dans la table `settings` (administrable) au lot 1.
   */
  get appLockIdleMinutes() {
    const value = Number(process.env.APP_LOCK_IDLE_MINUTES ?? 30);
    return Number.isFinite(value) && value > 0 ? value : 30;
  },
};
