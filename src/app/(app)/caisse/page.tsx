import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Calculator, FileBarChart, HandCoins, ListOrdered, Users } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { OperationCard } from "@/components/cash/OperationCard";
import { Card } from "@/components/ui/Card";
import { requirePermission, hasAny } from "@/lib/access";
import { monthBounds } from "@/lib/cash";
import { loadCashLabels, OPERATION_COLUMNS, type CashOperation } from "@/lib/cash-server";
import { formatMoney, formatMonth, todayIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Caisse" };

/** Accueil de la caisse : soldes, à valider, mois en cours, raccourcis. */
export default async function CashPage() {
  const access = await requirePermission("cash.manage", "cash.view", "cash.approve");
  const canManage = hasAny(access, ["cash.manage"]);
  const canApprove = hasAny(access, ["cash.approve"]);
  const supabase = await createClient();
  const month = todayIso().slice(0, 7);
  const { first, last } = monthBounds(month);
  const [{ data: balances }, { data: waiting }, { data: monthOps }, { data: counts }, labels] = await Promise.all([
    supabase.rpc("cash_balances"),
    supabase.from("cash_operations").select(OPERATION_COLUMNS).in("status", ["pending", "awaiting_pastor"]).order("created_at"),
    supabase.from("cash_operations").select("direction, amount").eq("status", "approved").gte("op_date", first).lte("op_date", last),
    supabase.from("offering_counts").select("id").eq("status", "pending"),
    loadCashLabels(),
  ]);
  const ops = (waiting ?? []) as unknown as CashOperation[];
  const mine = ops.filter((o) => (canManage && o.status === "pending" && o.entered_by !== access.personId) || (canApprove && o.status === "awaiting_pastor"));
  const others = ops.filter((o) => !mine.includes(o));
  const income = (monthOps ?? []).filter((o) => o.direction === "in").reduce((s, o) => s + o.amount, 0);
  const expense = (monthOps ?? []).filter((o) => o.direction === "out").reduce((s, o) => s + o.amount, 0);
  const total = ((balances ?? []) as { balance: number }[]).reduce((s, b) => s + Number(b.balance), 0);
  const accountName = (id: string) => labels.accounts.find((a) => a.id === id)?.name ?? "";

  const shortcuts = [
    canManage && { href: "/caisse/offrande", label: "Compter une offrande", icon: Calculator, accent: "bg-gold text-night" },
    canManage && { href: "/caisse/saisie?sens=in", label: "Recette", icon: ArrowDownLeft, accent: "bg-ok-ring text-white" },
    canManage && { href: "/caisse/saisie?sens=out", label: "Dépense", icon: ArrowUpRight, accent: "bg-alert-ring text-white" },
    { href: "/caisse/engagements", label: "Engagements", icon: HandCoins, accent: "bg-royal text-white" },
    { href: "/caisse/operations", label: "Opérations", icon: ListOrdered, accent: "bg-surface text-royal" },
    { href: "/caisse/rapports", label: "Arrêtés et rapports", icon: FileBarChart, accent: "bg-surface text-royal" },
    hasAny(access, ["cash.view"]) && { href: "/caisse/dimes", label: "Dîmes nominatives", icon: Users, accent: "bg-surface text-royal" },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Calculator; accent: string }[];

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title="Caisse" intro="Celui qui saisit n'est jamais celui qui valide." />

      <Card className="flex flex-col gap-2 shadow-card">
        <p className="text-sm text-muted">Solde total</p>
        <p className="font-display text-3xl font-bold text-royal">{formatMoney(total)}</p>
        <ul className="flex flex-col divide-y divide-line text-sm">
          {((balances ?? []) as { account_id: string; name: string; balance: number }[]).map((b) => (
            <li key={b.account_id} className="flex min-h-10 items-center justify-between">
              <span>{b.name}</span>
              <span className="font-semibold">{formatMoney(Number(b.balance))}</span>
            </li>
          ))}
        </ul>
        <p className="mt-1 grid grid-cols-2 gap-2 text-center text-sm">
          <span className="rounded-2xl bg-ok-bg p-2 text-ok-text">
            Recettes <span className="first-letter:uppercase">{formatMonth(`${month}-01`)}</span>
            <span className="block font-bold">{formatMoney(income)}</span>
          </span>
          <span className="rounded-2xl bg-alert-bg p-2 text-alert-text">
            Dépenses
            <span className="block font-bold">{formatMoney(expense)}</span>
          </span>
        </p>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        {shortcuts.map((s) => (
          <Link key={s.href} href={s.href} className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded-card p-2 text-center text-sm font-semibold shadow-card ${s.accent}`}>
            <s.icon aria-hidden className="size-6" />
            {s.label}
          </Link>
        ))}
      </div>

      {canManage && (counts ?? []).length > 0 && (
        <Link href="/caisse/offrande" className="rounded-2xl bg-warn-bg px-4 py-3 font-semibold text-warn-text">
          {(counts ?? []).length} comptage{(counts ?? []).length > 1 ? "s" : ""} d&apos;offrande à confirmer par une seconde personne →
        </Link>
      )}

      {mine.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">À valider par vous ({mine.length})</h2>
          {mine.map((o) => (
            <OperationCard
              key={o.id}
              op={o}
              me={access.personId}
              accountName={accountName(o.account_id)}
              categoryLabel={labels.category(o.direction, o.category)}
              canManage={canManage}
              canApprove={canApprove}
              reversed={false}
            />
          ))}
        </section>
      )}
      {others.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">En attente d&apos;une autre personne</h2>
          {others.map((o) => (
            <OperationCard
              key={o.id}
              op={o}
              me={access.personId}
              accountName={accountName(o.account_id)}
              categoryLabel={labels.category(o.direction, o.category)}
              canManage={canManage}
              canApprove={canApprove}
              reversed={false}
            />
          ))}
        </section>
      )}
    </div>
  );
}
