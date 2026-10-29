import { Baby, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { telHref } from "@/lib/contact-links";

type Adult = { name: string; relation: string; phone: string | null; can_pickup: boolean };

const RELATION: Record<string, string> = { parent: "Parent", guardian: "Tuteur", spouse: "Conjoint", child: "Enfant" };

/**
 * Enfants confiés au groupe (école du dimanche) : à la sortie, le moniteur voit qui peut
 * venir chercher chaque enfant. Les liens se saisissent sur la fiche de l'enfant.
 */
export async function ClassChildren({ groupId }: { groupId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("class_children", { p_group: groupId });
  if (error) return null;
  const children = (data ?? []) as { child_id: string; child: string; birth_date: string | null; adults: Adult[] }[];
  return (
    <Card className="flex flex-col gap-3 shadow-card">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Baby aria-hidden className="size-5 text-royal" /> Enfants confiés ({children.length})
      </h2>
      <p className="text-sm text-muted">À la sortie, ne confiez l&apos;enfant qu&apos;à une personne marquée « autorisée ».</p>
      <ul className="flex flex-col divide-y divide-line">
        {children.map((c) => (
          <li key={c.child_id} className="flex flex-col gap-1 py-2">
            <a href={`/fideles/${c.child_id}`} className="font-semibold">
              {c.child}
            </a>
            {c.adults.length === 0 && <span className="text-sm text-alert-text">Aucun adulte enregistré : à compléter sur sa fiche.</span>}
            {c.adults.map((a, i) => {
              return (
                <span key={i} className="flex flex-wrap items-center gap-x-2 text-sm">
                  <span>
                    {a.name} · {RELATION[a.relation] ?? a.relation}
                  </span>
                  {a.can_pickup && (
                    <span className="flex items-center gap-1 font-semibold text-ok-text">
                      <ShieldCheck aria-hidden className="size-4" /> autorisé(e)
                    </span>
                  )}
                  {a.phone && (
                    <a href={telHref(a.phone)} className="flex min-h-11 items-center font-semibold text-royal">
                      Appeler
                    </a>
                  )}
                </span>
              );
            })}
          </li>
        ))}
      </ul>
    </Card>
  );
}
