"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint } from "lucide-react";
import { signOut, unlockWithPassword } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { authenticateWithPasskey } from "./passkey-client";

export function UnlockPanel() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, passwordPending] = useActionState(unlockWithPassword, undefined);
  const asked = useRef(false);

  const unlock = useCallback(async () => {
    setError(undefined);
    setPending(true);
    try {
      await authenticateWithPasskey();
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setPending(false);
    }
  }, [router]);

  // Propose l'empreinte dès l'ouverture, une seule fois.
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    void unlock();
  }, [unlock]);

  return (
    <div className="flex flex-col gap-4">
      <Button type="button" fullWidth onClick={unlock} loading={pending}>
        {!pending && <Fingerprint aria-hidden className="size-6" />}
        Déverrouiller
      </Button>
      {error && (
        <p role="alert" className="text-center text-sm font-medium text-alert-text">
          {error}
        </p>
      )}

      {showPassword ? (
        <form action={formAction} className="flex flex-col gap-4">
          <TextField
            label="Mot de passe"
            name="password"
            type="password"
            autoComplete="current-password"
            autoFocus
            error={state?.fieldErrors?.password ?? state?.error}
          />
          <Button type="submit" variant="secondary" fullWidth loading={passwordPending}>
            Valider
          </Button>
        </form>
      ) : (
        <Button type="button" variant="ghost" fullWidth onClick={() => setShowPassword(true)}>
          Utiliser mon mot de passe
        </Button>
      )}

      <form action={signOut}>
        <Button type="submit" variant="ghost" fullWidth className="text-muted">
          Changer de compte
        </Button>
      </form>
    </div>
  );
}
