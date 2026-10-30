import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { FormCard } from "@/components/ui/FormCard";
import { ProgressBar } from "@/components/contributions/ProgressBar";
import { ActionForm } from "@/components/people/ActionForm";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { getAccess } from "@/lib/access";
import { PLEDGE_LABEL, pledgeState } from "@/lib/cash";
import { formatMoney, formatShortDay, todayIso } from "@/lib/format";
import { loadValueList } from "@/lib/people";
import { createClient } from "@/lib/supabase/server";
import { declareGift, selfPledge } from "../caisse/actions";

export const metadata: Metadata = { title: "Dons" };

type Pledge = {
  id: string;
  amount: number;
  due_date: string | null;
  campaigns: { title: string; status: string } | null;
  cash_operations: { amount: number; status: string }[];
};

/**
 * Dons du fidèle à l'église : donner (dîme, don, action de grâce) par Mobile Money ou en espèces,
 * suivre ses engagements. À ne pas confondre avec les cotisations de famille ou de groupe.
 */
export default async function GivingPage() {
  const access = await getAccess();
  const supabase = await createClient();
  const today = todayIso();
  const year = today.slice(0, 4);
  const [{ data: pledges }, { data: campaigns }, { data: mine }, methods, { data: instructions }] = await Promise.all([
    supabase
      .from("pledges")
      .select("id, amount, due_date, campaigns(title, status), cash_operations(amount, status)")
      .eq("person_id", access.personId ?? ""),
    supabase.from("campaigns").select("id, title, description").eq("status", "open").order("created_at", { ascending: false }),
    supabase
      .from("cash_operations")
      .select("id, amount, category, status, op_date, anonymous")
      .eq("person_id", access.personId ?? "")
      .eq("direction", "in")
      .gte("op_date", `${year}-01-01`)
      .order("op_date", { ascending: false })
      .limit(20),
    loadValueList("payment_method"),
    supabase.from("settings").select("value").eq("key", "giving_instructions").maybeSingle(),
  ]);
  const myPledges = (pledges ?? []) as unknown as Pledge[];
  const pledgedCampaigns = new Set(myPledges.map((p) => p.campaigns?.title));
  const openToPledge = (campaigns ?? []).filter((c) => !pledgedCampaigns.has(c.title));
  const howTo = (instructions?.value as string | undefined) || "Demandez au caissier le numéro Mobile Money de l'église.";
  const CATEGORY: Record<string, string> = { tithe: "Dîme", gift: "Don", thanksgiving: "Action de grâce", pledge: "Engagement" };
  const STATUS: Record<string, string> = { pending: "en vérification", awaiting_pastor: "en vérification", approved: "reçu, merci", rejected: "non reconnu" };
  const totalYear = (mine ?? []).filter((o) => o.status === "approved").reduce((s, o) => s + o.amount, 0);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title="Dons" intro="Dîmes, dons et engagements envers l'église. (Les cotisations de famille ou de groupe sont dans « Cotisations ».)" />

      <FormCard title="Donner" subtitle="Dîme, don, action de grâce." icon="hand-heart" tone="gold">
        <p className="mb-3 rounded-2xl bg-white/80 p-3 text-sm">{howTo}</p>
        <ActionForm action={declareGift} submitLabel="J'ai donné : prévenir la caisse" variant="primary">
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Quoi"
              name="category"
              options={[
                { value: "tithe", label: "Dîme" },
                { value: "gift", label: "Don" },
                { value: "thanksgiving", label: "Action de grâce" },
              ]}
            />
            <TextField label="Montant (FCFA)" name="amount" inputMode="numeric" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Par" name="method" options={methods} defaultValue="orange_money" />
            <TextField label="Référence (SMS)" name="reference" />
          </div>
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <input type="checkbox" name="anonymous" className="mt-1 size-5 accent-royal" />
            <span>Dîme anonyme : mon nom n&apos;apparaîtra pas dans le suivi des dîmes.</span>
          </label>
        </ActionForm>
      </FormCard>

      {myPledges.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Mes engagements</h2>
          {myPledges.map((p) => {
            const paid = p.cash_operations.filter((o) => o.status === "approved").reduce((s, o) => s + o.amount, 0);
            const state = pledgeState(p.amount, paid, p.due_date, today);
            const rest = Math.max(0, p.amount - paid);
            return (
              <Card key={p.id} className="flex flex-col gap-2 shadow-card">
                <p className="flex items-start justify-between gap-2">
                  <span className="font-semibold">{p.campaigns?.title}</span>
                  <span className="rounded-full bg-cloud px-2 py-0.5 text-xs font-semibold">{PLEDGE_LABEL[state]}</span>
                </p>
                <ProgressBar total={paid} target={p.amount} />
                {p.due_date && <p className="text-sm text-muted">Échéance : {formatShortDay(p.due_date)}</p>}
                {rest > 0 && p.campaigns?.status === "open" && (
                  <details className="rounded-xl bg-cloud px-3">
                    <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-royal">J&apos;ai versé une partie</summary>
                    <ActionForm action={declareGift} hidden={{ category: "pledge", pledge_id: p.id }} submitLabel="Prévenir la caisse" className="flex flex-col gap-3 pb-3">
                      <div className="grid grid-cols-2 gap-3">
                        <TextField label="Montant" name="amount" inputMode="numeric" defaultValue={String(rest)} />
                        <SelectField label="Par" name="method" options={methods} defaultValue="orange_money" />
                      </div>
                      <TextField label="Référence (SMS)" name="reference" />
                    </ActionForm>
                  </details>
                )}
              </Card>
            );
          })}
        </section>
      )}

      {openToPledge.map((c) => (
        <Card key={c.id} className="flex flex-col gap-2 shadow-card">
          <h2 className="font-semibold">{c.title}</h2>
          {c.description && <p className="text-sm text-muted">{c.description}</p>}
          <details className="rounded-xl bg-cloud px-3">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-royal">Je m&apos;engage</summary>
            <ActionForm action={selfPledge} hidden={{ campaign_id: c.id }} submitLabel="M'engager" className="flex flex-col gap-3 pb-3">
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Montant promis" name="amount" inputMode="numeric" required />
                <TextField label="Avant le" name="due_date" type="date" />
              </div>
            </ActionForm>
          </details>
        </Card>
      ))}

      {(mine ?? []).length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Mes dons en {year}</h2>
          <ul className="flex flex-col divide-y divide-line rounded-card bg-surface px-4 text-sm shadow-card">
            {(mine ?? []).map((o) => (
              <li key={o.id} className="flex min-h-12 items-center justify-between gap-2">
                <span>
                  {CATEGORY[o.category] ?? "Don"}
                  {o.anonymous ? " (anonyme)" : ""} · {formatShortDay(o.op_date)} · <span className="text-muted">{STATUS[o.status]}</span>
                </span>
                <span className="font-semibold">{formatMoney(o.amount)}</span>
              </li>
            ))}
          </ul>
          <Link href={`/dons/attestation?annee=${year}`} className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-royal/10 font-semibold text-royal">
            <FileText aria-hidden className="size-5" /> Mon attestation {year} ({formatMoney(totalYear)})
          </Link>
        </section>
      )}
    </div>
  );
}
