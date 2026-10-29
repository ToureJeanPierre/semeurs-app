import type { Metadata } from "next";
import { PageTitle } from "@/components/admin/AdminCard";
import { OperationCard } from "@/components/cash/OperationCard";
import { SelectField } from "@/components/ui/SelectField";
import { hasAny, requirePermission } from "@/lib/access";
import { monthBounds } from "@/lib/cash";
import { loadCashLabels, OPERATION_COLUMNS, type CashOperation } from "@/lib/cash-server";
import { recentPeriods } from "@/lib/contributions";
import { formatMonth, todayIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Opérations" };

/** Toutes les opérations d'un mois, avec leurs justificatifs ; rien n'est effacé, les annulations restent visibles. */
export default async function OperationsPage({ searchParams }: PageProps<"/caisse/operations">) {
  const access = await requirePermission("cash.manage", "cash.view", "cash.approve");
  const params = await searchParams;
  const months = recentPeriods(todayIso(), 12);
  const month = typeof params.mois === "string" && /^\d{4}-\d{2}$/.test(params.mois) ? params.mois : months[0];
  const { first, last } = monthBounds(month);
  const supabase = await createClient();
  const [{ data }, labels] = await Promise.all([
    supabase.from("cash_operations").select(OPERATION_COLUMNS).gte("op_date", first).lte("op_date", last).order("op_date", { ascending: false }).order("created_at", { ascending: false }),
    loadCashLabels(),
  ]);
  const ops = (data ?? []) as unknown as CashOperation[];
  const reversed = new Set(ops.map((o) => o.reverses_id).filter(Boolean));
  const paths = ops.map((o) => o.attachment_path).filter((p): p is string => Boolean(p));
  const { data: signed } = paths.length ? await supabase.storage.from("justificatifs").createSignedUrls(paths, 3600) : { data: [] };
  const urlOf = (path: string | null) => (path ? signed?.find((s) => s.path === path)?.signedUrl ?? null : null);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title="Opérations" />
      <form action="/caisse/operations" className="flex items-end gap-2">
        <SelectField label="Mois" name="mois" defaultValue={month} options={months.map((m) => ({ value: m, label: formatMonth(`${m}-01`) }))} className="flex-1" />
        <button type="submit" className="min-h-13 rounded-2xl bg-royal/10 px-4 font-semibold text-royal">Voir</button>
      </form>
      {ops.length === 0 && <p className="rounded-card bg-surface p-4 text-muted">Aucune opération ce mois-ci.</p>}
      {ops.map((o) => (
        <OperationCard
          key={o.id}
          op={o}
          me={access.personId}
          accountName={labels.accounts.find((a) => a.id === o.account_id)?.name ?? ""}
          categoryLabel={labels.category(o.direction, o.category)}
          canManage={hasAny(access, ["cash.manage"])}
          canApprove={hasAny(access, ["cash.approve"])}
          reversed={reversed.has(o.id)}
          attachmentUrl={urlOf(o.attachment_path)}
        />
      ))}
    </div>
  );
}
