import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { PersonPicker } from "@/components/admin/PersonPicker";
import { ProgressBar } from "@/components/contributions/ProgressBar";
import { ActionForm } from "@/components/people/ActionForm";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { hasAny, requirePermission } from "@/lib/access";
import { loadPeopleOptions } from "@/lib/admin";
import { PLEDGE_LABEL, pledgeState, rate, type PledgeState } from "@/lib/cash";
import { loadCashLabels } from "@/lib/cash-server";
import { whatsappHref } from "@/lib/contact-links";
import { formatMoney, formatShortDay, todayIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { addPledge, closeCampaign, recordPledgePayment } from "../../actions";

export const metadata: Metadata = { title: "Campagne" };

const STATE_CLS: Record<PledgeState, string> = {
  settled: "bg-ok-bg text-ok-text",
  late: "bg-alert-bg text-alert-text",
  due_soon: "bg-warn-bg text-warn-text",
  on_track: "bg-cloud text-ink",
};

type Row = { pledge_id: string; person_id: string | null; name: string; phone: string | null; amount: number; due_date: string | null; paid: number; pending: number };

/** Une campagne : engagements devant le nom de chaque fidèle, versements, états, relances. */
export default async function CampaignPage({ params }: PageProps<"/caisse/engagements/[id]">) {
  const access = await requirePermission("cash.manage", "cash.view", "cash.approve");
  const canManage = hasAny(access, ["cash.manage"]);
  const { id } = await params;
  const supabase = await createClient();
  const { data: c } = await supabase.from("campaigns").select("id, title, description, target_amount, status, end_date").eq("id", id).maybeSingle();
  if (!c) notFound();
  const [{ data }, people, labels] = await Promise.all([
    supabase.rpc("pledge_overview", { p_campaign: id }),
    canManage ? loadPeopleOptions() : Promise.resolve([]),
    loadCashLabels(),
  ]);
  const rows = (data ?? []) as Row[];
  const today = todayIso();
  const promised = rows.reduce((s, r) => s + r.amount, 0);
  const paid = rows.reduce((s, r) => s + Number(r.paid), 0);
  const open = c.status === "open";

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title={c.title} intro={c.description ?? undefined} />
      <Card className="flex flex-col gap-2 shadow-card">
        <ProgressBar total={paid} target={promised || c.target_amount} />
        <p className="text-sm text-muted">
          Promis {formatMoney(promised)}
          {c.target_amount ? ` (objectif ${formatMoney(c.target_amount)})` : ""} · réalisé {rate(paid, promised)} %
        </p>
      </Card>

      {rows.map((r) => {
        const state = pledgeState(r.amount, Number(r.paid), r.due_date, today);
        const rest = Math.max(0, r.amount - Number(r.paid));
        return (
          <Card key={r.pledge_id} className="flex flex-col gap-2 shadow-card">
            <p className="flex items-start justify-between gap-2">
              <span>
                <span className="block font-semibold">{r.name}</span>
                <span className="block text-sm text-muted">
                  {formatMoney(Number(r.paid))} / {formatMoney(r.amount)}
                  {r.due_date ? ` · échéance ${formatShortDay(r.due_date)}` : ""}
                  {Number(r.pending) ? ` · ${formatMoney(Number(r.pending))} à valider` : ""}
                </span>
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STATE_CLS[state]}`}>{PLEDGE_LABEL[state]}</span>
            </p>
            {canManage && open && rest > 0 && (
              <details className="rounded-xl bg-cloud px-3">
                <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-royal">Enregistrer un versement</summary>
                <ActionForm action={recordPledgePayment} hidden={{ pledge_id: r.pledge_id }} submitLabel="Enregistrer" className="flex flex-col gap-3 pb-3">
                  <div className="grid grid-cols-2 gap-3">
                    <TextField label="Montant" name="amount" inputMode="numeric" defaultValue={String(rest)} />
                    <SelectField label="Compte" name="account_id" options={labels.accounts.map((a) => ({ value: a.id, label: a.name }))} />
                    <SelectField label="Moyen" name="method" options={labels.methods} />
                    <TextField label="Référence" name="reference" />
                  </div>
                </ActionForm>
              </details>
            )}
            {canManage && r.phone && (state === "late" || state === "due_soon") && (
              <a
                href={whatsappHref(r.phone, `Bonjour, petit rappel fraternel pour votre engagement « ${c.title} » : il reste ${rest.toLocaleString("fr-FR")} FCFA. Que Dieu vous bénisse.`)}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-11 items-center gap-2 text-sm font-semibold text-[#1f8f4e]"
              >
                <MessageCircle aria-hidden className="size-4" /> Relancer sur WhatsApp
              </a>
            )}
          </Card>
        );
      })}

      {canManage && open && (
        <Card className="shadow-card">
          <h2 className="mb-2 text-lg font-semibold">Inscrire un engagement</h2>
          <ActionForm action={addPledge} hidden={{ campaign_id: id }} submitLabel="Inscrire" variant="primary">
            <PersonPicker name="person_id" label="Fidèle" people={people} />
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" name="anonymous" className="size-5 accent-royal" /> Engagement anonyme
            </label>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Montant promis" name="amount" inputMode="numeric" required />
              <TextField label="Échéance" name="due_date" type="date" defaultValue={c.end_date ?? ""} />
            </div>
          </ActionForm>
        </Card>
      )}
      {canManage && open && (
        <form action={closeCampaign}>
          <input type="hidden" name="campaign_id" value={id} />
          <SubmitButton className="min-h-11 w-full rounded-full text-sm font-semibold text-muted hover:bg-cloud">Clôturer la campagne</SubmitButton>
        </form>
      )}
    </div>
  );
}
