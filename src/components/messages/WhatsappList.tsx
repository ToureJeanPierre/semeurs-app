"use client";

import { useState } from "react";
import { CircleCheck, MessageCircle } from "lucide-react";

export type WhatsappRow = { person_id: string; first_name: string; last_name: string; phone: string | null; sent_at: string | null };

/** WhatsApp assisté : un message prêt par destinataire ; la ligne se coche une fois ouverte. */
export function WhatsappList({
  rows,
  body,
  markSent,
}: {
  rows: WhatsappRow[];
  body: string;
  markSent: (personId: string) => Promise<void>;
}) {
  const [sent, setSent] = useState(() => new Set(rows.filter((r) => r.sent_at).map((r) => r.person_id)));
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => {
        const done = sent.has(r.person_id);
        const text = body.replaceAll("{prénom}", r.first_name);
        return (
          <li key={r.person_id} className={`flex items-center gap-3 rounded-card p-3 shadow-card ${done ? "bg-ok-bg" : "bg-surface"}`}>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">
                {r.last_name.toUpperCase()} {r.first_name}
              </span>
              <span className="block text-sm text-muted">{done ? "Message ouvert dans WhatsApp" : r.phone ? "À envoyer" : "Pas de numéro"}</span>
            </span>
            {done ? (
              <CircleCheck aria-label="Envoyé" className="size-7 text-ok-ring" />
            ) : r.phone ? (
              <a
                href={`https://wa.me/${r.phone.replace("+", "")}?text=${encodeURIComponent(text)}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  setSent((s) => new Set(s).add(r.person_id));
                  void markSent(r.person_id);
                }}
                className="flex min-h-11 items-center gap-2 rounded-full bg-[#1f8f4e] px-4 font-semibold text-white"
              >
                <MessageCircle aria-hidden className="size-5" />
                Envoyer
              </a>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
