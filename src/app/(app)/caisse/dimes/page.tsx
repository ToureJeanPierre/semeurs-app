import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { SelectField } from "@/components/ui/SelectField";
import { requirePermission } from "@/lib/access";
import { personName } from "@/lib/admin";
import { formatMoney, todayIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dîmes nominatives" };

/** Suivi des dîmes nominatives par fidèle (les dîmes anonymes n'y figurent pas). */
export default async function TithesPage({ searchParams }: PageProps<"/caisse/dimes">) {
  await requirePermission("cash.view", "cash.manage");
  const thisYear = Number(todayIso().slice(0, 4));
  const year = Number((await searchParams).annee) || thisYear;
  const supabase = await createClient();
  const { data } = await supabase
    .from("cash_operations")
    .select("person_id, amount, op_date, person:people!cash_operations_person_id_fkey(first_name, last_name)")
    .eq("category", "tithe")
    .eq("status", "approved")
    .eq("anonymous", false)
    .not("person_id", "is", null)
    .gte("op_date", `${year}-01-01`)
    .lte("op_date", `${year}-12-31`);
  const byPerson = new Map<string, { name: string; total: number; count: number; last: string }>();
  for (const r of (data ?? []) as unknown as { person_id: string; amount: number; op_date: string; person: { first_name: string; last_name: string } | null }[]) {
    const cur = byPerson.get(r.person_id) ?? { name: r.person ? personName(r.person) : "?", total: 0, count: 0, last: "" };
    cur.total += r.amount;
    cur.count += 1;
    if (r.op_date > cur.last) cur.last = r.op_date;
    byPerson.set(r.person_id, cur);
  }
  const rows = [...byPerson.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name, "fr"));

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title="Dîmes nominatives" intro="Par fidèle et par année. Touchez un nom pour son attestation." />
      <form action="/caisse/dimes" className="flex items-end gap-2">
        <SelectField label="Année" name="annee" defaultValue={String(year)} options={[thisYear, thisYear - 1, thisYear - 2].map((y) => ({ value: String(y), label: String(y) }))} className="flex-1" />
        <button type="submit" className="min-h-13 rounded-2xl bg-royal/10 px-4 font-semibold text-royal">Voir</button>
      </form>
      {rows.length === 0 && <p className="rounded-card bg-surface p-4 text-muted">Aucune dîme nominative cette année.</p>}
      <ul className="flex flex-col divide-y divide-line rounded-card bg-surface px-4 shadow-card">
        {rows.map(([id, r]) => (
          <li key={id}>
            <Link href={`/caisse/dimes/${id}?annee=${year}`} className="flex min-h-14 items-center gap-2">
              <span className="flex-1">
                <span className="block font-semibold">{r.name}</span>
                <span className="block text-sm text-muted">{r.count} versement{r.count > 1 ? "s" : ""}</span>
              </span>
              <span className="font-semibold">{formatMoney(r.total)}</span>
              <ChevronRight aria-hidden className="size-5 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
