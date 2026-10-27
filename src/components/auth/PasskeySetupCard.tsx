"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import { canUsePasskeys, registerPasskey } from "./passkey-client";

/**
 * Invite à activer l'empreinte / le schéma sur ce téléphone.
 * `compact` : simple bouton (page Profil).
 */
export function PasskeySetupCard({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<ToastMessage>(null);

  useEffect(() => {
    canUsePasskeys().then(setSupported);
  }, []);

  async function activate() {
    setPending(true);
    try {
      await registerPasskey();
      setToast({ tone: "success", text: "C'est activé : vous ouvrirez l'appli comme vous ouvrez votre téléphone." });
      router.refresh();
    } catch (error) {
      setToast({ tone: "error", text: (error as Error).message });
    } finally {
      setPending(false);
    }
  }

  if (supported === null) return null;

  if (!supported) {
    return compact ? (
      <p className="text-sm text-muted">
        Ce téléphone ne permet pas d&apos;ouvrir l&apos;appli avec son verrouillage. Vous continuerez avec
        votre mot de passe.
      </p>
    ) : null;
  }

  const button = (
    <Button type="button" variant={compact ? "secondary" : "gold"} fullWidth onClick={activate} loading={pending}>
      {!pending && <LockKeyhole aria-hidden className="size-6" />}
      {compact ? "Ajouter ce téléphone" : "Activer maintenant"}
    </Button>
  );

  return (
    <>
      {compact ? (
        button
      ) : (
        <Card className="flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-royal/10 text-royal">
              <LockKeyhole aria-hidden className="size-7" strokeWidth={1.8} />
            </span>
            <div>
              <h2 className="text-xl font-semibold">Ouvrir l&apos;appli d&apos;un geste</h2>
              <p className="mt-1 text-muted">
                Ouvrez l&apos;appli comme vous ouvrez votre téléphone : empreinte, schéma ou code,
                selon ce que vous avez réglé. Rien n&apos;est envoyé : tout reste dans votre téléphone.
              </p>
            </div>
          </div>
          {button}
        </Card>
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
