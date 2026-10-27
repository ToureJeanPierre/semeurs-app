"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { fillTemplate } from "@/lib/contact-links";
import { ContactButtons } from "./ContactButtons";
import { VigilanceAvatar, type VigilanceLevel } from "@/components/ui/VigilanceAvatar";

export type ContactRow = {
  person_id: string;
  name: string;
  firstName: string;
  level: VigilanceLevel;
  days_absent: number;
  treated: boolean;
  phone: string | null; // +225…
  whatsapp?: string | null;
  note?: string | null;
};

/**
 * « À contacter cette semaine » : triée par urgence. Appeler, SMS et WhatsApp en un geste,
 * le message de prise de nouvelles (modèle modifiable) déjà écrit avec le prénom.
 */
export function ContactList({ rows, empty, template }: { rows: ContactRow[]; empty: string; template?: string }) {
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
          className="flex flex-col gap-3 rounded-card bg-surface p-3 shadow-card"
        >
          <Link href={`/fideles/${r.person_id}`} className="flex min-w-0 items-center gap-3">
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
            <ContactButtons
              name={r.name}
              phone={r.phone}
              whatsapp={r.whatsapp}
              message={template ? fillTemplate(template, r.firstName) : undefined}
            />
          )}
        </motion.li>
      ))}
    </ul>
  );
}
