"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Fingerprint } from "lucide-react";
import { signOut, unlockWithPassword } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { authenticateWithPasskey } from "./passkey-client";

/** Attend que l'appli soit au premier plan et que l'écran de lancement soit parti. */
function whenReady(): Promise<void> {
  return new Promise((resolve) => {
    const splashVisible = !document.documentElement.classList.contains("splash-seen");
    const delay = splashVisible ? 1900 : 250;
    const check = () => {
      if (document.visibilityState === "visible" && document.hasFocus()) resolve();
      else setTimeout(check, 200);
    };
    setTimeout(check, delay);
  });
}

/**
 * Déverrouillage : la demande d'empreinte ou de schéma s'affiche d'elle-même.
 * Si Android refuse cette première demande automatique (appli pas encore prête),
 * on n'affiche pas d'erreur : il suffit de toucher le grand bouton.
 */
export function UnlockPanel() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, passwordPending] = useActionState(unlockWithPassword, undefined);
  const asked = useRef(false);

  const unlock = useCallback(
    async (automatic = false) => {
      setError(undefined);
      setPending(true);
      try {
        await authenticateWithPasskey();
        router.replace("/");
        router.refresh();
      } catch (e) {
        if (!automatic) setError((e as Error).message);
        setPending(false);
      }
    },
    [router],
  );

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    void whenReady().then(() => unlock(true));
  }, [unlock]);

  return (
    <div className="flex flex-col items-center gap-6">
      <motion.button
        type="button"
        onClick={() => unlock()}
        disabled={pending}
        whileTap={{ scale: 0.94 }}
        aria-label="Déverrouiller avec l'empreinte ou le schéma"
        className="relative grid size-28 place-items-center rounded-full bg-white text-royal shadow-float disabled:opacity-90"
      >
        <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-white/30" />
        <Fingerprint aria-hidden className="relative size-14" strokeWidth={1.6} />
      </motion.button>
      <p className="text-center text-lg font-semibold text-white">
        {pending ? "Posez votre doigt ou tracez votre schéma…" : "Touchez pour déverrouiller"}
      </p>
      {error && (
        <p role="alert" className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-medium text-alert-text">
          {error}
        </p>
      )}

      <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
        {showPassword ? (
          <form action={formAction} className="flex flex-col gap-3 rounded-card bg-white p-4">
            <TextField
              label="Mot de passe"
              name="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              error={state?.fieldErrors?.password ?? state?.error}
            />
            <Button type="submit" fullWidth loading={passwordPending}>
              Valider
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowPassword(true)}
            className="min-h-12 rounded-full font-semibold text-white/90 underline-offset-4 hover:underline"
          >
            Utiliser mon mot de passe
          </button>
        )}
        <form action={signOut}>
          <button type="submit" className="min-h-12 w-full rounded-full text-sm font-medium text-white/75">
            Changer de compte
          </button>
        </form>
      </div>
    </div>
  );
}
