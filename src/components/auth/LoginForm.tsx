"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { loginWithPassword } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { authenticateWithPasskey, canUsePasskeys } from "./passkey-client";

export function LoginForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(loginWithPassword, undefined);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [passkeyPending, setPasskeyPending] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string>();

  useEffect(() => {
    canUsePasskeys().then(setPasskeyAvailable);
  }, []);

  async function handlePasskey() {
    setPasskeyError(undefined);
    setPasskeyPending(true);
    try {
      await authenticateWithPasskey();
      router.replace("/");
      router.refresh();
    } catch (error) {
      setPasskeyError((error as Error).message);
      setPasskeyPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {passkeyAvailable && (
        <div className="flex flex-col gap-3">
          <Button type="button" variant="primary" fullWidth onClick={handlePasskey} loading={passkeyPending}>
            {!passkeyPending && <LockKeyhole aria-hidden className="size-6" />}
            Avec le verrouillage du téléphone
          </Button>
          {passkeyError && (
            <p role="alert" className="text-center text-sm font-medium text-alert-text">
              {passkeyError}
            </p>
          )}
          <div className="flex items-center gap-3 text-sm text-muted">
            <span className="h-px flex-1 bg-line" />
            ou avec votre mot de passe
            <span className="h-px flex-1 bg-line" />
          </div>
        </div>
      )}

      <form action={formAction} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Numéro de téléphone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="username"
          placeholder="07 08 31 04 33"
          prefix="+225"
          required
          error={state?.fieldErrors?.phone}
        />
        <TextField
          label="Mot de passe"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          error={state?.fieldErrors?.password}
        />
        {state?.error && (
          <p role="alert" className="rounded-2xl bg-alert-bg px-4 py-3 text-sm font-medium text-alert-text">
            {state.error}
          </p>
        )}
        <Button type="submit" variant={passkeyAvailable ? "secondary" : "primary"} fullWidth loading={pending}>
          Se connecter
        </Button>
        <p className="text-center text-sm text-muted">
          Mot de passe oublié ? Demandez à votre père de famille ou à l&apos;administrateur
          de vous en donner un nouveau.
        </p>
      </form>
    </div>
  );
}
