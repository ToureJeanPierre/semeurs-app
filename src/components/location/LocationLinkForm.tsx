"use client";

import { useActionState } from "react";
import { MessageCircle, Send } from "lucide-react";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";

/**
 * Pour un fidèle sans compte : crée un lien à usage unique, puis l'envoie par WhatsApp.
 * Le fidèle l'ouvre chez lui et touche « Partager ma position ».
 */
export function LocationLinkForm({
  action,
  personId,
  firstName,
  phone,
  origin,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  personId: string;
  firstName: string;
  phone: string | null;
  origin: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const token = state?.success?.startsWith("LIEN:") ? state.success.slice(5) : null;
  const link = token ? `${origin}/p/position/${token}` : null;
  const text = link
    ? `Bonjour ${firstName}, pour que l'église puisse te rendre visite, ouvre ce lien quand tu es chez toi et touche « Partager ma position » : ${link}`
    : "";

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="person_id" value={personId} />
      {link ? (
        <>
          <p className="break-all rounded-xl bg-royal/5 p-3 text-sm">{link}</p>
          {phone ? (
            <a
              href={`https://wa.me/${phone.replace("+", "")}?text=${encodeURIComponent(text)}`}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#1f8f4e] font-semibold text-white"
            >
              <MessageCircle aria-hidden className="size-5" />
              Envoyer par WhatsApp
            </a>
          ) : (
            <p className="text-sm text-muted">Copiez ce lien et envoyez-le à {firstName}.</p>
          )}
          <p className="text-xs text-muted">Valable 7 jours, une seule fois.</p>
        </>
      ) : (
        <>
          {state?.error && <p role="alert" className="text-sm font-medium text-alert-text">{state.error}</p>}
          <Button type="submit" variant="secondary" loading={pending}>
            {!pending && <Send aria-hidden className="size-5" />}
            Demander sa position par un lien
          </Button>
        </>
      )}
    </form>
  );
}
