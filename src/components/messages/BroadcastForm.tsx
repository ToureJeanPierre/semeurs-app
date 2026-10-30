"use client";

import { useActionState, useRef, useState } from "react";
import type { FormState } from "@/app/actions/auth";
import { FormFeedback } from "@/components/admin/FormFeedback";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

export type Target = { id: string; name: string; type: string };

/** Rédaction d'un message groupé, avec la puce {prénom} et un aperçu personnalisé (docs/03 §5.4). */
export function BroadcastForm({
  action,
  church,
  groups,
  templates,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  church: boolean;
  groups: Target[];
  templates: { code: string; label: string; body: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [body, setBody] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);

  function insertFirstName() {
    const el = area.current;
    if (!el) return;
    const start = el.selectionStart ?? body.length;
    const next = `${body.slice(0, start)}{prénom}${body.slice(el.selectionEnd ?? start)}`;
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + 8, start + 8);
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Destinataires</legend>
        <div className="flex flex-col gap-1">
          {church && (
            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-royal/5">
              <input type="checkbox" name="targets" value="church" className="size-5 accent-royal" />
              <span className="font-semibold">Toute l&apos;église</span>
            </label>
          )}
          {groups.map((g) => (
            <label key={g.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-royal/5">
              <input type="checkbox" name="targets" value={g.id} className="size-5 accent-royal" />
              <span>
                <span className="font-semibold">{g.name}</span> <span className="text-sm text-muted">({g.type})</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <TextField label="Titre" name="title" error={state?.fieldErrors?.title} />

      {templates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {templates.map((t) => (
            <button key={t.code} type="button" onClick={() => setBody(t.body)} className="min-h-10 rounded-full bg-royal/10 px-3 text-sm font-semibold text-royal">
              Modèle : {t.label}
            </button>
          ))}
        </div>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="flex items-center justify-between text-sm font-semibold">
          Message
          <button type="button" onClick={insertFirstName} className="min-h-10 rounded-full bg-gold/25 px-3 text-sm font-semibold text-night">
            + {"{prénom}"}
          </button>
        </span>
        <textarea
          ref={area}
          name="body"
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="rounded-2xl border-2 border-[#c9daf6] bg-[#f4f8ff] p-3 text-base focus:border-royal focus:bg-white focus:ring-4 focus:ring-royal/10"
        />
      </label>
      {body && (
        <div className="rounded-2xl bg-[#e7f6ec] p-3 text-sm">
          <p className="mb-1 text-xs font-semibold text-muted">Aperçu pour « Awa »</p>
          <p className="whitespace-pre-wrap">{body.replaceAll("{prénom}", "Awa")}</p>
        </div>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Comment l&apos;envoyer ?</legend>
        <div className="flex flex-col gap-2">
          {[
            ["app", "Dans l'appli", "Une notification pour chaque destinataire qui a un compte."],
            ["whatsapp", "Par WhatsApp (gratuit)", "L'appli prépare un message personnalisé pour chacun : vous touchez « Envoyer » personne par personne."],
          ].map(([value, label, hint], i) => (
            <label key={value} className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-[#c9daf6] bg-[#f4f8ff] p-3 has-checked:border-royal has-checked:bg-royal/5">
              <input type="radio" name="channel" value={value} defaultChecked={i === 0} className="mt-0.5 size-5 accent-royal" />
              <span>
                <span className="block font-semibold">{label}</span>
                <span className="block text-sm text-muted">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <FormFeedback state={state} />
      <Button type="submit" fullWidth loading={pending}>
        Envoyer le message
      </Button>
    </form>
  );
}
