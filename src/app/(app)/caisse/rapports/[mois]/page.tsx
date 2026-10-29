import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { DocumentHeader } from "@/components/contributions/ReceiptHeader";
import { Card } from "@/components/ui/Card";
import { PrintButton } from "@/components/ui/PrintButton";
import { requirePermission } from "@/lib/access";
import { loadCashLabels } from "@/lib/cash-server";
import { formatFullDate, formatMoney, formatMonth } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Rapport de caisse" };

type Report = {
  month: string;
  opening: { name: string; balance: number }[];
  closing: { name: string; balance: number }[];
  income: Record<string, number>;
  expense: Record<string, number>;
  pending: number;
  closed: { closed_at: string } | null;
};

/** Rapport mensuel : soldes, recettes et dépenses par catégorie, budget de l'année ; imprimable et exportable. */
export default async function MonthReportPage({ params }: PageProps<"/caisse/rapports/[mois]">) {
  await requirePermission("cash.manage", "cash.view", "cash.approve");
  const { mois } = await params;
  if (!/^\d{4}-\d{2}$/.test(mois)) notFound();
  const supabase = await createClient();
  const [{ data, error }, { data: profile }, labels, { data: budgets }] = await Promise.all([
    supabase.rpc("month_report", { p_month: mois }),
    supabase.from("settings").select("value").eq("key", "church_profile").maybeSingle(),
    loadCashLabels(),
    supabase.from("budgets").select("direction, category, amount").eq("year", Number(mois.slice(0, 4))),
  ]);
  if (error || !data) notFound();
  const r = data as Report;
  const sum = (o: Record<string, number>) => Object.values(o).reduce((s, v) => s + Number(v), 0);
  const totalIn = sum(r.income);
  const totalOut = sum(r.expense);
  const budgetOf = (direction: string, category: string) => (budgets ?? []).find((b) => b.direction === direction && b.category === category)?.amount;

  const table = (title: string, direction: "in" | "out", rows: Record<string, number>, total: number) => (
    <section>
      <h2 className="mb-1 font-semibold">{title}</h2>
      <table className="w-full text-sm">
        <tbody>
          {Object.entries(rows).map(([cat, amount]) => (
            <tr key={cat} className="border-b border-line">
              <td className="py-1">{labels.category(direction, cat)}</td>
              <td className="py-1 text-right text-xs text-muted">{budgetOf(direction, cat) ? `budget annuel ${formatMoney(budgetOf(direction, cat)!)}` : ""}</td>
              <td className="py-1 text-right font-semibold">{formatMoney(Number(amount))}</td>
            </tr>
          ))}
          <tr>
            <td className="py-1 font-bold">Total</td>
            <td />
            <td className="py-1 text-right font-bold">{formatMoney(total)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-8 pt-5 print:max-w-none print:p-0">
      <Card className="flex flex-col gap-4 shadow-card print:shadow-none">
        <DocumentHeader profile={(profile?.value ?? {}) as object} />
        <div>
          <h1 className="font-display text-2xl font-extrabold first-letter:uppercase">Rapport de caisse : {formatMonth(`${mois}-01`)}</h1>
          <p className="text-sm text-muted">
            {r.closed ? `Mois arrêté le ${formatFullDate(r.closed.closed_at)}` : `Mois non arrêté${r.pending ? ` · ${r.pending} opération(s) en attente` : ""}`}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-2xl bg-ok-bg p-2 text-ok-text">Recettes<p className="font-bold">{formatMoney(totalIn)}</p></div>
          <div className="rounded-2xl bg-alert-bg p-2 text-alert-text">Dépenses<p className="font-bold">{formatMoney(totalOut)}</p></div>
          <div className="rounded-2xl bg-cloud p-2">Résultat<p className="font-bold">{formatMoney(totalIn - totalOut)}</p></div>
        </div>
        <section>
          <h2 className="mb-1 font-semibold">Soldes par compte</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1 font-normal">Compte</th>
                <th className="py-1 text-right font-normal">Début du mois</th>
                <th className="py-1 text-right font-normal">Fin du mois</th>
              </tr>
            </thead>
            <tbody>
              {(r.closing ?? []).map((c, i) => (
                <tr key={c.name} className="border-b border-line">
                  <td className="py-1">{c.name}</td>
                  <td className="py-1 text-right">{formatMoney(Number(r.opening?.[i]?.balance ?? 0))}</td>
                  <td className="py-1 text-right font-semibold">{formatMoney(Number(c.balance))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        {table("Recettes", "in", r.income, totalIn)}
        {table("Dépenses", "out", r.expense, totalOut)}
      </Card>
      <PrintButton />
      <a href={`/api/caisse/export?mois=${mois}`} className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-royal/10 font-semibold text-royal print:hidden">
        <Download aria-hidden className="size-5" /> Télécharger pour Excel
      </a>
    </div>
  );
}
