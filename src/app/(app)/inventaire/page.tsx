import type { Metadata } from "next";
import Link from "next/link";
import { Package, Wrench } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { PersonPicker } from "@/components/admin/PersonPicker";
import { ActionForm } from "@/components/people/ActionForm";
import { Card } from "@/components/ui/Card";
import { SelectField, TextAreaField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { getAccess, hasAny } from "@/lib/access";
import { loadPeopleOptions, personName } from "@/lib/admin";
import { addDays, formatMoney, formatShortDay, todayIso } from "@/lib/format";
import { loadValueList } from "@/lib/people";
import { createClient } from "@/lib/supabase/server";
import { addItem, addMovement, updateItem } from "./actions";

export const metadata: Metadata = { title: "Inventaire" };

type Item = {
  id: string;
  name: string;
  category: string | null;
  group_id: string | null;
  quantity: number;
  value: number | null;
  condition: string;
  location: string | null;
  next_maintenance_on: string | null;
  groups: { name: string } | null;
  inventory_movements: { kind: string; moved_on: string; note: string | null; people: { first_name: string; last_name: string } | null }[];
};

const CONDITION_CLS: Record<string, string> = { good: "bg-ok-bg text-ok-text", worn: "bg-warn-bg text-warn-text", broken: "bg-alert-bg text-alert-text" };

/** Biens de l'église et des groupes : état, emplacement, prêts et entretien. */
export default async function InventoryPage({ searchParams }: PageProps<"/inventaire">) {
  const groupFilter = String((await searchParams).groupe ?? "");
  const access = await getAccess();
  const churchManager = hasAny(access, ["inventory.manage"]);
  const supabase = await createClient();
  let query = supabase
    .from("inventory_items")
    .select(
      "id, name, category, group_id, quantity, value, condition, location, next_maintenance_on, groups(name), inventory_movements(kind, moved_on, note, people:people!inventory_movements_person_id_fkey(first_name, last_name))",
    )
    .eq("active", true)
    .order("name");
  if (groupFilter) query = query.eq("group_id", groupFilter);
  const [{ data }, { data: myGroups }, conditions, movements, people] = await Promise.all([
    query,
    supabase.rpc("my_groups_with", { p_permission: "groups.manage" }),
    loadValueList("inventory_condition"),
    loadValueList("inventory_movement"),
    hasAny(access, ["inventory.manage", "groups.manage"], "any") ? loadPeopleOptions() : Promise.resolve([]),
  ]);
  const items = (data ?? []) as unknown as Item[];
  const groups = (myGroups ?? []) as { id: string; name: string }[];
  const canAdd = churchManager || groups.length > 0;
  const today = todayIso();
  const soon = addDays(today, 14);
  const total = items.reduce((s, i) => s + (i.value ?? 0) * i.quantity, 0);
  const label = (list: { value: string; label: string }[], v: string) => list.find((x) => x.value === v)?.label ?? v;
  const groupOptions = [...(churchManager ? [{ value: "", label: "Église" }] : []), ...groups.map((g) => ({ value: g.id, label: g.name }))];
  if (groupFilter) groupOptions.sort((a, b) => Number(b.value === groupFilter) - Number(a.value === groupFilter));

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title="Inventaire" intro="Matériel, instruments, mobilier : où il est, dans quel état, qui l'a emprunté." />
      {groupFilter && (
        <Link href="/inventaire" className="text-sm font-semibold text-royal">
          ← Tout l&apos;inventaire
        </Link>
      )}
      <Card className="flex items-center justify-between shadow-card">
        <span className="text-sm text-muted">
          {items.length} bien{items.length > 1 ? "s" : ""}
        </span>
        <span className="font-display text-xl font-bold text-royal">{formatMoney(total)}</span>
      </Card>

      {canAdd && (
        <details className="rounded-card bg-surface px-4 shadow-card">
          <summary className="flex min-h-12 cursor-pointer items-center font-semibold text-royal">Ajouter un bien</summary>
          <ActionForm action={addItem} submitLabel="Ajouter" variant="primary" className="flex flex-col gap-3 pb-4">
            <TextField label="Nom" name="name" placeholder="Clavier Yamaha" required />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Catégorie" name="category" placeholder="Sono, mobilier…" />
              <SelectField label="Appartient à" name="group_id" options={groupOptions} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Quantité" name="quantity" inputMode="numeric" defaultValue="1" />
              <TextField label="Valeur unitaire (FCFA)" name="value" inputMode="numeric" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SelectField label="État" name="condition" options={conditions} />
              <TextField label="Emplacement" name="location" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Acquis le" name="acquired_on" type="date" />
              <TextField label="Prochain entretien" name="next_maintenance_on" type="date" />
            </div>
            <TextAreaField label="Notes" name="notes" />
          </ActionForm>
        </details>
      )}

      {items.length === 0 && <p className="rounded-2xl bg-cloud p-4 text-sm text-muted">Aucun bien enregistré.</p>}
      {items.map((i) => {
        const canManage = churchManager || (!!i.group_id && groups.some((g) => g.id === i.group_id));
        const last = [...i.inventory_movements].sort((a, b) => b.moved_on.localeCompare(a.moved_on));
        const onLoan = last[0]?.kind === "loan";
        const due = i.next_maintenance_on && i.next_maintenance_on <= soon;
        return (
          <Card key={i.id} className="flex flex-col gap-2 shadow-card">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-royal/10 text-royal">
                <Package aria-hidden className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">
                  {i.name}
                  {i.quantity > 1 ? ` × ${i.quantity}` : ""}
                </span>
                <span className="block text-sm text-muted">
                  {[i.category, i.groups?.name ?? "Église", i.location].filter(Boolean).join(" · ")}
                  {i.value ? ` · ${formatMoney(i.value * i.quantity)}` : ""}
                </span>
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${CONDITION_CLS[i.condition] ?? "bg-cloud"}`}>
                {label(conditions, i.condition)}
              </span>
            </div>
            {onLoan && (
              <p className="rounded-xl bg-warn-bg px-3 py-2 text-sm text-warn-text">
                Prêté{last[0].people ? ` à ${personName(last[0].people)}` : ""} le {formatShortDay(last[0].moved_on)}
              </p>
            )}
            {due && (
              <p className="flex items-center gap-2 rounded-xl bg-gold/15 px-3 py-2 text-sm">
                <Wrench aria-hidden className="size-4" /> Entretien prévu le {formatShortDay(i.next_maintenance_on!)}
              </p>
            )}
            {canManage && (
              <details className="rounded-xl bg-cloud px-3">
                <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-royal">Prêt, retour, réparation…</summary>
                <ActionForm action={addMovement} hidden={{ item_id: i.id }} submitLabel="Noter" className="flex flex-col gap-3 pb-3">
                  <SelectField label="Mouvement" name="kind" options={movements} defaultValue={onLoan ? "return" : "loan"} />
                  <PersonPicker name="person_id" label="Personne (facultatif)" people={people} />
                  <TextField label="Note" name="note" />
                </ActionForm>
                <ActionForm action={updateItem} hidden={{ item_id: i.id }} submitLabel="Mettre à jour" className="flex flex-col gap-3 border-t border-line pb-3 pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <SelectField label="État" name="condition" options={conditions} defaultValue={i.condition} />
                    <TextField label="Quantité" name="quantity" inputMode="numeric" defaultValue={String(i.quantity)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <TextField label="Emplacement" name="location" defaultValue={i.location ?? ""} />
                    <TextField label="Prochain entretien" name="next_maintenance_on" type="date" defaultValue={i.next_maintenance_on ?? ""} />
                  </div>
                </ActionForm>
                {last.length > 0 && (
                  <ul className="flex flex-col gap-1 border-t border-line pb-3 pt-2 text-xs text-muted">
                    {last.slice(0, 5).map((m, k) => (
                      <li key={k}>
                        {formatShortDay(m.moved_on)} · {label(movements, m.kind)}
                        {m.people ? ` · ${personName(m.people)}` : ""}
                        {m.note ? ` · ${m.note}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            )}
          </Card>
        );
      })}
    </div>
  );
}
