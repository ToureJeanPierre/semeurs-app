import { CakeSlice, MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";

export type BirthdayRow = { id: string; firstName: string; name: string; inDays: number; phone: string | null };

/** Anniversaires des 7 prochains jours, avec un message de vœux prêt à envoyer sur WhatsApp. */
export function Birthdays({ rows, template }: { rows: BirthdayRow[]; template: string }) {
  if (rows.length === 0) return null;
  return (
    <Card className="flex flex-col gap-2 shadow-card">
      <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
        <CakeSlice aria-hidden className="size-5 text-warm" />
        Anniversaires de la semaine
      </h3>
      <ul className="flex flex-col divide-y divide-line">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{r.name}</span>
              <span className="block text-sm text-muted">
                {r.inDays === 0 ? "Aujourd'hui !" : r.inDays === 1 ? "Demain" : `Dans ${r.inDays} jours`}
              </span>
            </span>
            {r.phone && (
              <a
                href={`https://wa.me/${r.phone.replace("+", "")}?text=${encodeURIComponent(template.replaceAll("{prénom}", r.firstName))}`}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-11 items-center gap-2 rounded-full bg-[#1f8f4e] px-4 text-sm font-semibold text-white"
              >
                <MessageCircle aria-hidden className="size-4" />
                Souhaiter
              </a>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
