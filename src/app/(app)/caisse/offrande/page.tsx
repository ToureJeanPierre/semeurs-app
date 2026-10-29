import type { Metadata } from "next";
import { PageTitle } from "@/components/admin/AdminCard";
import { CountForm } from "@/components/cash/CountForm";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { requirePermission } from "@/lib/access";
import { personName } from "@/lib/admin";
import { loadCashLabels } from "@/lib/cash-server";
import { formatMoney, formatShortDay, todayIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { confirmCount } from "../actions";

export const metadata: Metadata = { title: "Comptage des offrandes" };

type Count = {
  id: string;
  op_date: string;
  service_label: string | null;
  category: string;
  denominations: Record<string, number>;
  total: number;
  counter_1: string;
  counter: { first_name: string; last_name: string } | null;
};

/** Comptage à deux : le premier saisit les coupures, une seconde personne confirme. */
export default async function OfferingCountPage() {
  const access = await requirePermission("cash.manage");
  const supabase = await createClient();
  const [{ data: setting }, { data: pending }, labels] = await Promise.all([
    supabase.from("settings").select("value").eq("key", "cash_denominations").maybeSingle(),
    supabase
      .from("offering_counts")
      .select("id, op_date, service_label, category, denominations, total, counter_1, counter:people!offering_counts_counter_1_fkey(first_name, last_name)")
      .eq("status", "pending")
      .order("created_at"),
    loadCashLabels(),
  ]);
  const denominations = (setting?.value as number[] | undefined) ?? [10000, 5000, 2000, 1000, 500, 250, 200, 100, 50, 25, 10, 5];

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title="Comptage des offrandes" intro="Billets et pièces, le total se fait tout seul. Une seconde personne confirme." />
      {((pending ?? []) as unknown as Count[]).map((c) => (
        <Card key={c.id} className="flex flex-col gap-2 border-2 border-gold/60 shadow-card">
          <p className="flex items-baseline justify-between gap-2">
            <span className="font-semibold">
              {c.service_label ?? labels.category("in", c.category)} · {formatShortDay(c.op_date)}
            </span>
            <span className="font-display text-xl font-bold text-royal">{formatMoney(c.total)}</span>
          </p>
          <p className="text-sm text-muted">
            Compté par {c.counter ? personName(c.counter) : "?"} :{" "}
            {Object.entries(c.denominations)
              .sort((a, b) => Number(b[0]) - Number(a[0]))
              .map(([v, n]) => `${n} × ${Number(v).toLocaleString("fr-FR")}`)
              .join(", ")}
          </p>
          {c.counter_1 === access.personId ? (
            <p className="text-sm font-semibold text-warn-text">Une autre personne doit recompter et confirmer.</p>
          ) : (
            <form action={confirmCount}>
              <input type="hidden" name="count_id" value={c.id} />
              <SubmitButton className="min-h-12 w-full rounded-full bg-ok-ring font-semibold text-white">J&apos;ai recompté : je confirme {formatMoney(c.total)}</SubmitButton>
            </form>
          )}
        </Card>
      ))}
      <Card className="shadow-card">
        <CountForm
          denominations={denominations}
          accounts={labels.accounts.map((a) => ({ value: a.id, label: a.name }))}
          categories={labels.income.filter((c) => ["offering", "tithe", "thanksgiving", "collection"].includes(c.value))}
          today={todayIso()}
        />
      </Card>
    </div>
  );
}
