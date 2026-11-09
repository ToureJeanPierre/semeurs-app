import type { Metadata } from "next";
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
import { formatPhone, parseIvorianPhone } from "@/lib/phone";
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
const CATEGORY_LABEL: Record<string, string> = { offering: "Offrande", gift: "Don", thanksgiving: "Action de grâce", pledge: "Engagement" };
const STATUS_LABEL: Record<string, string> = { pending: "en vérification", awaiting_pastor: "en vérification", approved: "reçu, merci", rejected: "non reconnu" };

export default async function GivingPage() {
  const access = await getAccess();
  const supabase = await createClient();
  const today = todayIso();
  const [{ data: pledges }, { data: campaigns }, { data: mine }, methods, { data: instructions }, { data: myTithes }, { data: tithePhone }] = await Promise.all([
    supabase
      .from("pledges")
      .select("id, amount, due_date, campaigns(title, status), cash_operations(amount, status)")
      .eq("person_id", access.personId ?? ""),
    supabase.from("campaigns").select("id, title, description").eq("status", "open").order("created_at", { ascending: false }),
    supabase
      .from("cash_operations")
      .select("id, amount, category, status, op_date")
      .eq("person_id", access.personId ?? "")
      .eq("direction", "in")
      .order("op_date", { ascending: false })
      .limit(10),
    loadValueList("payment_method"),
    supabase.from("settings").select("value").eq("key", "giving_instructions").maybeSingle(),
    supabase.from("tithes").select("id, amount, status, tithe_date, anonymous").eq("person_id", access.personId ?? "").order("tithe_date", { ascending: false }).limit(10),
    supabase.from("settings").select("value").eq("key", "tithe_phone").maybeSingle(),
  ]);
  const pastorPhone = typeof tithePhone?.value === "string" ? parseIvorianPhone(tithePhone.value) : null;
  // Mes dîmes (chez le pasteur) et mes autres dons (caisse), dans une seule liste.
  const TITHE_STATUS: Record<string, string> = { pending: "en vérification", received: "reçue, merci", not_received: "non reçue" };
  const history = [
    ...(mine ?? []).map((o) => ({ id: o.id, label: CATEGORY_LABEL[o.category] ?? "Don", date: o.op_date, amount: o.amount, status: STATUS_LABEL[o.status], anonymous: false })),
    ...(myTithes ?? []).map((t) => ({ id: t.id, label: "Dîme", date: t.tithe_date, amount: t.amount, status: TITHE_STATUS[t.status], anonymous: t.anonymous })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);
  const myPledges = (pledges ?? []) as unknown as Pledge[];
  const pledgedCampaigns = new Set(myPledges.map((p) => p.campaigns?.title));
  const openToPledge = (campaigns ?? []).filter((c) => !pledgedCampaigns.has(c.title));
  const howTo = (instructions?.value as string | undefined) || "Demandez au caissier le numéro Mobile Money de l'église.";

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title="Dons" intro="Dîme au pasteur, offrandes, dons et engagements. (Les cotisations de famille ou de groupe sont dans « Cotisations ».)" />

      <FormCard title="Ma dîme" subtitle="Envoyée directement au pasteur : lui seul la voit." icon="hand-heart" tone="gold">
        {pastorPhone && (
          <p className="mb-3 rounded-2xl bg-white/80 p-3 text-sm">
            Numéro Mobile Money du pasteur : <span className="font-display text-lg font-bold text-night">{formatPhone(pastorPhone)}</span>
          </p>
        )}
        <ActionForm action={declareGift} hidden={{ category: "tithe" }} submitLabel="J'ai envoyé ma dîme : prévenir le pasteur" variant="primary">
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Montant (FCFA)" name="amount" inputMode="numeric" required />
            <SelectField label="Par" name="method" options={methods} defaultValue="orange_money" />
          </div>
          <TextField label="Référence (SMS)" name="reference" />
        </ActionForm>
      </FormCard>

      <FormCard title="Offrande et dons" subtitle="Offrande, don, action de grâce : à la caisse de l'église." icon="hand-heart" tone="royal">
        <p className="mb-3 rounded-2xl bg-white/80 p-3 text-sm">{howTo}</p>
        <ActionForm action={declareGift} submitLabel="J'ai donné : prévenir la caisse" variant="primary">
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Quoi"
              name="category"
              options={[
                { value: "offering", label: "Offrande" },
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

      {history.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Mes derniers dons</h2>
          <ul className="flex flex-col divide-y divide-line rounded-card bg-surface px-4 text-sm shadow-card">
            {history.map((o) => (
              <li key={o.id} className="flex min-h-12 items-center justify-between gap-2">
                <span>
                  {o.label} · {formatShortDay(o.date)} · <span className="text-muted">{o.status}</span>
                </span>
                <span className="font-semibold">{formatMoney(o.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
