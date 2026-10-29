import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { ProgressBar } from "@/components/contributions/ProgressBar";
import { ActionForm } from "@/components/people/ActionForm";
import { Card } from "@/components/ui/Card";
import { TextAreaField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { hasAny, requirePermission } from "@/lib/access";
import { rate } from "@/lib/cash";
import { formatMoney, todayIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { createCampaign } from "../actions";

export const metadata: Metadata = { title: "Engagements" };

/** Campagnes d'engagements (promesses de dons) : promis, encaissé, taux de réalisation. */
export default async function CampaignsPage() {
  const access = await requirePermission("cash.manage", "cash.view", "cash.approve");
  const supabase = await createClient();
  const { data } = await supabase
    .from("campaigns")
    .select("id, title, target_amount, status, pledges(amount, cash_operations(amount, status))")
    .order("created_at", { ascending: false });
  const campaigns = (data ?? []) as unknown as {
    id: string;
    title: string;
    target_amount: number | null;
    status: string;
    pledges: { amount: number; cash_operations: { amount: number; status: string }[] }[];
  }[];

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title="Engagements" intro="Promesses de dons pour un projet : chaque fidèle s'engage, la caisse suit." />
      {campaigns.map((c) => {
        const promised = c.pledges.reduce((s, p) => s + p.amount, 0);
        const paid = c.pledges.reduce((s, p) => s + p.cash_operations.filter((o) => o.status === "approved").reduce((t, o) => t + o.amount, 0), 0);
        return (
          <Link key={c.id} href={`/caisse/engagements/${c.id}`} className="flex flex-col gap-2 rounded-card bg-surface p-4 shadow-card">
            <span className="flex items-center justify-between gap-2">
              <span className="font-semibold">{c.title}{c.status === "closed" ? " · clôturée" : ""}</span>
              <ChevronRight aria-hidden className="size-5 text-muted" />
            </span>
            <ProgressBar total={paid} target={promised || c.target_amount} />
            <span className="text-sm text-muted">
              {c.pledges.length} engagement{c.pledges.length > 1 ? "s" : ""} · promis {formatMoney(promised)} · réalisé {rate(paid, promised)} %
            </span>
          </Link>
        );
      })}
      {campaigns.length === 0 && <p className="rounded-card bg-surface p-4 text-muted">Aucune campagne pour l&apos;instant.</p>}
      {hasAny(access, ["cash.manage"]) && (
        <Card className="shadow-card">
          <h2 className="mb-2 text-lg font-semibold">Lancer une campagne</h2>
          <ActionForm action={createCampaign} submitLabel="Lancer la campagne" variant="primary">
            <TextField label="Titre" name="title" placeholder="Construction du temple" required />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Objectif (FCFA)" name="target_amount" inputMode="numeric" />
              <TextField label="Fin (facultatif)" name="end_date" type="date" />
            </div>
            <input type="hidden" name="start_date" value={todayIso()} />
            <TextAreaField label="Présentation" name="description" rows={3} />
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
