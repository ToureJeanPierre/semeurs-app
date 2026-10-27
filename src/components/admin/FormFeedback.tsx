import { CircleAlert, CircleCheck } from "lucide-react";
import type { FormState } from "@/app/actions/auth";

/** Message de résultat d'un formulaire (réussite en vert, erreur en rouge, toujours avec un libellé). */
export function FormFeedback({ state }: { state: FormState }) {
  if (state?.error) {
    return (
      <p role="alert" className="flex items-start gap-2 rounded-2xl bg-alert-bg px-4 py-3 text-sm font-medium text-alert-text">
        <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
        {state.error}
      </p>
    );
  }
  const messages = Object.values(state?.fieldErrors ?? {});
  if (messages.length > 0) {
    return (
      <p role="alert" className="flex items-start gap-2 rounded-2xl bg-alert-bg px-4 py-3 text-sm font-medium text-alert-text">
        <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
        {messages.join(" ")}
      </p>
    );
  }
  if (state?.success) {
    return (
      <p role="status" className="flex items-start gap-2 rounded-2xl bg-ok-bg px-4 py-3 text-sm font-medium text-ok-text">
        <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0" />
        {state.success}
      </p>
    );
  }
  return null;
}
