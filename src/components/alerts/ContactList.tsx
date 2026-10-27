"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { MessageCircle, Phone } from "lucide-react";
import { VigilanceAvatar, type VigilanceLevel } from "@/components/ui/VigilanceAvatar";

export type ContactRow = {
  person_id: string;
  name: string;
  level: VigilanceLevel;
  days_absent: number;
  treated: boolean;
  phone: string | null; // +225…
  note?: string | null;
};

/** « À contacter cette semaine » : triée par urgence, avec Appeler et WhatsApp en un geste. */
export function ContactList({ rows, empty }: { rows: ContactRow[]; empty: string }) {
  if (rows.length === 0) {
    return <p className="rounded-card bg-ok-bg p-4 font-medium text-ok-text">{empty}</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r, i) => (
        <motion.li
          key={r.person_id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 + i * 0.06 }}
          className="flex items-center gap-3 rounded-card bg-surface p-3 shadow-card"
        >
          <Link href={`/fideles/${r.person_id}`} className="flex min-w-0 flex-1 items-center gap-3">
            <VigilanceAvatar name={r.name} level={r.level} size={48} />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{r.name}</span>
              <span className="block text-sm text-muted">
                {r.days_absent} jours d&apos;absence{r.treated ? " · contacté(e)" : ""}
                {r.note ? ` · ${r.note}` : ""}
              </span>
            </span>
          </Link>
          {r.phone && (
            <div className="flex shrink-0 gap-1">
              <a href={`tel:${r.phone}`} aria-label={`Appeler ${r.name}`} className="grid size-11 place-items-center rounded-full bg-royal text-white">
                <Phone aria-hidden className="size-5" />
              </a>
              <a
                href={`https://wa.me/${r.phone.replace("+", "")}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`Écrire à ${r.name} sur WhatsApp`}
                className="grid size-11 place-items-center rounded-full bg-[#1f8f4e] text-white"
              >
                <MessageCircle aria-hidden className="size-5" />
              </a>
            </div>
          )}
        </motion.li>
      ))}
    </ul>
  );
}
