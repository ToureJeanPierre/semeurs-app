import Link from "next/link";
import { ShieldCheck, X } from "lucide-react";
import { removeRelation, addRelation } from "@/app/(app)/fideles/relations-actions";
import { PersonPicker, type PersonOption } from "@/components/admin/PersonPicker";
import { ActionForm } from "@/components/people/ActionForm";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { personName } from "@/lib/admin";
import { loadValueList } from "@/lib/people";
import { createClient } from "@/lib/supabase/server";

type Relation = {
  id: string;
  relation: string;
  can_pickup: boolean;
  related_id: string;
  related: { first_name: string; last_name: string } | null;
};

/**
 * Liens de parenté d'une fiche (parent, enfant, conjoint, tuteur) et, pour un enfant,
 * les adultes autorisés à venir le chercher à l'école du dimanche.
 */
export async function PersonRelations({ personId, canManage, people }: { personId: string; canManage: boolean; people: PersonOption[] }) {
  const supabase = await createClient();
  const [{ data }, kinds] = await Promise.all([
    supabase
      .from("person_relations")
      .select("id, relation, can_pickup, related_id, related:people!person_relations_related_id_fkey(first_name, last_name)")
      .eq("person_id", personId),
    loadValueList("relation_kind"),
  ]);
  const relations = (data ?? []) as unknown as Relation[];
  if (relations.length === 0 && !canManage) return null;
  const label = (k: string) => kinds.find((x) => x.value === k)?.label ?? k;
  return (
    <section aria-labelledby="liens" className="flex flex-col gap-2">
      <h2 id="liens" className="text-lg font-semibold">
        Liens de parenté
      </h2>
      <Card className="flex flex-col gap-2 shadow-card">
        {relations.length === 0 && <p className="text-sm text-muted">Aucun lien enregistré.</p>}
        <ul className="flex flex-col divide-y divide-line">
          {relations.map((r) => (
            <li key={r.id} className="flex min-h-12 items-center gap-2">
              <Link href={`/fideles/${r.related_id}`} className="min-w-0 flex-1">
                <span className="block font-semibold">{r.related ? personName(r.related) : ""}</span>
                <span className="flex items-center gap-1 text-sm text-muted">
                  {label(r.relation)}
                  {r.can_pickup && (
                    <>
                      {" · "}
                      <ShieldCheck aria-hidden className="size-4 text-ok-text" /> peut récupérer l&apos;enfant
                    </>
                  )}
                </span>
              </Link>
              {canManage && (
                <form action={removeRelation}>
                  <input type="hidden" name="relation_id" value={r.id} />
                  <input type="hidden" name="person_id" value={personId} />
                  <SubmitButton className="grid size-11 place-items-center rounded-full text-muted" aria-label="Retirer ce lien">
                    <X aria-hidden className="size-4" />
                  </SubmitButton>
                </form>
              )}
            </li>
          ))}
        </ul>
        {canManage && (
          <details className="rounded-xl bg-cloud px-3">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-royal">Ajouter un lien</summary>
            <ActionForm action={addRelation} hidden={{ person_id: personId }} submitLabel="Ajouter" className="flex flex-col gap-3 pb-3">
              <PersonPicker name="related_id" label="Personne" people={people.filter((p) => p.id !== personId)} />
              <SelectField label="Est son/sa" name="relation" options={kinds} />
              <label className="flex min-h-11 items-start gap-3 text-sm">
                <input type="checkbox" name="can_pickup" className="mt-1 size-5 accent-royal" />
                <span>Autorisé(e) à récupérer l&apos;enfant à l&apos;école du dimanche</span>
              </label>
            </ActionForm>
          </details>
        )}
      </Card>
    </section>
  );
}
