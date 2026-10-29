import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { ActionForm } from "@/components/people/ActionForm";
import { Card } from "@/components/ui/Card";
import { hasAny, requirePermission } from "@/lib/access";
import { recentPeriods } from "@/lib/contributions";
import { formatFullDate, formatMonth, todayIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { closeMonth, setBudget } from "../actions";
import { TextField } from "@/components/ui/TextField";
import { loadCashLabels } from "@/lib/cash-server";

export const metadata: Metadata = { title: "Arrêtés et rapports" };

/** Arrêté mensuel (verrouille le mois) et rapport de chaque mois. */
export default async function ReportsPage() {
  const access = await requirePermission("cash.manage", "cash.view", "cash.approve");
  const supabase = await createClient();
  const year = Number(todayIso().slice(0, 4));
  const [{ data: closings }, { data: budgets }, labels] = await Promise.all([
    supabase.from("period_closings").select("month, closed_at"),
    supabase.from("budgets").select("direction, category, amount").eq("year", year),
    loadCashLabels(),
  ]);
  const budgetOf = (direction: string, category: string) => (budgets ?? []).find((b) => b.direction === direction && b.category === category)?.amount;
  const months = recentPeriods(todayIso(), 12);
  const current = months[0];
  const closed = new Map((closings ?? []).map((c) => [c.month, c.closed_at]));
  const toClose = months.slice(1).reverse().find((m) => !closed.has(m));

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title="Arrêtés et rapports" intro="Un mois arrêté ne peut plus être modifié ; son rapport est envoyé au pasteur." />
      {hasAny(access, ["cash.manage"]) && toClose && (
        <Card className="flex flex-col gap-2 border-2 border-gold/60 shadow-card">
          <h2 className="font-semibold first-letter:uppercase">Arrêter {formatMonth(`${toClose}-01`)}</h2>
          <p className="text-sm text-muted">Toutes les opérations du mois doivent être validées. Le rapport sera produit automatiquement.</p>
          <ActionForm action={closeMonth} hidden={{ month: toClose }} submitLabel="Arrêter le mois" variant="gold" />
        </Card>
      )}
      <ul className="flex flex-col gap-2">
        {months.map((m) => (
          <li key={m}>
            <Link href={`/caisse/rapports/${m}`} className="flex min-h-14 items-center gap-3 rounded-card bg-surface px-4 shadow-card">
              <span className="flex-1">
                <span className="block font-semibold first-letter:uppercase">{formatMonth(`${m}-01`)}</span>
                <span className="block text-sm text-muted">
                  {closed.has(m) ? `Arrêté le ${formatFullDate(closed.get(m)!)}` : m === current ? "Mois en cours" : "Pas encore arrêté"}
                </span>
              </span>
              {closed.has(m) && <Lock aria-hidden className="size-4 text-ok-text" />}
              <ChevronRight aria-hidden className="size-5 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
      {hasAny(access, ["cash.manage"]) && (
        <details className="rounded-card bg-surface px-4 shadow-card">
          <summary className="flex min-h-14 cursor-pointer items-center font-semibold">Budget {year}</summary>
          <ActionForm action={setBudget} hidden={{ year: String(year) }} submitLabel="Enregistrer le budget" className="flex flex-col gap-2 pb-4">
            <p className="text-sm text-muted">Montant prévu pour l&apos;année, par catégorie (il apparaît dans les rapports).</p>
            {[
              ["in", labels.income],
              ["out", labels.expense],
            ].map(([direction, cats]) =>
              (cats as { value: string; label: string }[]).map((c) => (
                <TextField
                  key={`${direction}-${c.value}`}
                  label={`${direction === "in" ? "Recette" : "Dépense"} · ${c.label}`}
                  name={`b_${direction}_${c.value}`}
                  inputMode="numeric"
                  defaultValue={budgetOf(direction as string, c.value) ? String(budgetOf(direction as string, c.value)) : ""}
                />
              )),
            )}
          </ActionForm>
        </details>
      )}
    </div>
  );
}
