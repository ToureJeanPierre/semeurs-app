import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Receipt } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { DeclareForm } from "@/components/contributions/DeclareForm";
import { ProgressBar } from "@/components/contributions/ProgressBar";
import { Card } from "@/components/ui/Card";
import { getAccess, hasAny } from "@/lib/access";
import { collected, recentPeriods, remaining, type Heading, type Payment } from "@/lib/contributions";
import { formatFullDate, formatMoney, formatShortDay, todayIso } from "@/lib/format";
import { loadValueList } from "@/lib/people";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Cotisations" };

type HeadingRow = Heading & { contribution_payments: Pick<Payment, "id" | "person_id" | "amount" | "status" | "period" | "receipt_no" | "created_at">[] };

/** Mes cotisations (ce que je dois, mes reçus) et, pour la trésorière, celles qu'elle gère. */
export default async function ContributionsPage() {
  const access = await getAccess();
  const supabase = await createClient();
  const today = todayIso();
  const [{ data }, { data: myGroups }, { data: managed }, { data: followed }, kinds, methods, { data: groups }] = await Promise.all([
    supabase
      .from("contribution_headings")
      .select("*, contribution_payments(id, person_id, amount, status, period, receipt_no, created_at)")
      .order("created_at", { ascending: false }),
    supabase.rpc("my_groups"),
    supabase.rpc("my_groups_with", { p_permission: "contributions.manage" }),
    supabase.rpc("my_groups_with", { p_permission: "contributions.view" }),
    loadValueList("contribution_kind"),
    loadValueList("payment_method"),
    supabase.from("groups").select("id, name"),
  ]);
  const headings = (data ?? []) as HeadingRow[];
  const mine = new Set(((myGroups ?? []) as { id: string }[]).map((g) => g.id));
  const followIds = new Set([...((managed ?? []) as { id: string }[]), ...((followed ?? []) as { id: string }[])].map((g) => g.id));
  const churchFollow = hasAny(access, ["contributions.manage", "contributions.view"]);
  const canLaunch = hasAny(access, ["contributions.manage"]) || (managed ?? []).length > 0;
  const groupName = (id: string | null) => (id ? (groups ?? []).find((g) => g.id === id)?.name ?? "Groupe" : "Toute l'église");
  const kindLabel = (k: string) => kinds.find((x) => x.value === k)?.label ?? k;

  const concernsMe = headings.filter(
    (h) => h.status === "open" && h.beneficiary_id !== access.personId && (h.group_id === null || mine.has(h.group_id)),
  );
  const following = headings.filter((h) => (h.group_id === null ? churchFollow : churchFollow || followIds.has(h.group_id)));
  const myReceipts = headings
    .flatMap((h) => h.contribution_payments.filter((p) => p.person_id === access.personId && p.receipt_no && p.amount > 0).map((p) => ({ ...p, title: h.title })))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const periods = recentPeriods(today, 3);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pb-8 pt-5">
      <PageTitle title="Cotisations" intro="Soutenir un frère, une sœur, un projet : chaque versement reçoit son reçu." />

      {canLaunch && (
        <Link href="/cotisations/nouvelle" className="flex min-h-14 items-center justify-center gap-2 rounded-card bg-royal font-semibold text-white shadow-card">
          <Plus aria-hidden className="size-5" /> Lancer une cotisation
        </Link>
      )}

      {following.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="suivi">
          <h2 id="suivi" className="text-lg font-semibold">Je suis ces cotisations</h2>
          {following.map((h) => {
            const pending = h.contribution_payments.filter((p) => p.status === "declared").length;
            return (
              <Link key={h.id} href={`/cotisations/${h.id}`} className="flex flex-col gap-2 rounded-card bg-surface p-4 shadow-card active:scale-[0.99]">
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block font-semibold">{h.title}</span>
                    <span className="block text-sm text-muted">
                      {kindLabel(h.kind)} · {groupName(h.group_id)}
                      {h.status === "closed" ? " · clôturée" : ""}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="mt-1 size-5 shrink-0 text-muted" />
                </span>
                <ProgressBar total={collected(h.contribution_payments)} target={h.target_amount} />
                {pending > 0 && (
                  <span className="self-start rounded-full bg-warn-bg px-3 py-1 text-sm font-semibold text-warn-text">
                    {pending} versement{pending > 1 ? "s" : ""} à valider
                  </span>
                )}
              </Link>
            );
          })}
        </section>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="miennes">
        <h2 id="miennes" className="text-lg font-semibold">Mes cotisations</h2>
        {concernsMe.length === 0 && <p className="rounded-card bg-surface p-4 text-muted">Aucune cotisation en cours pour vous.</p>}
        {concernsMe.map((h) => {
          const myPayments = h.contribution_payments.filter(
            (p) => p.person_id === access.personId && (h.recurrence !== "monthly" || p.period === periods[0]),
          );
          const paid = collected(myPayments);
          const declared = myPayments.filter((p) => p.status === "declared").reduce((s, p) => s + p.amount, 0);
          const due = h.amount_mode === "fixed" ? remaining(h.amount, paid + declared) : null;
          return (
            <Card key={h.id} className="flex flex-col gap-2 shadow-card">
              <p>
                <span className="block font-semibold">{h.title}</span>
                <span className="block text-sm text-muted">
                  {kindLabel(h.kind)} · {groupName(h.group_id)}
                  {h.due_date ? ` · avant le ${formatShortDay(h.due_date)}` : ""}
                </span>
              </p>
              {h.description && <p className="text-sm">{h.description}</p>}
              <p className="text-sm">
                {h.amount_mode === "fixed"
                  ? `Montant : ${formatMoney(h.amount!)}${h.recurrence === "monthly" ? " par mois" : ""}`
                  : `Montant libre${h.min_amount ? ` (à partir de ${formatMoney(h.min_amount)})` : ""}`}
              </p>
              <p className="flex flex-wrap gap-2 text-sm font-semibold">
                {paid > 0 && <span className="rounded-full bg-ok-bg px-3 py-1 text-ok-text">Payé : {formatMoney(paid)}</span>}
                {declared > 0 && <span className="rounded-full bg-warn-bg px-3 py-1 text-warn-text">En attente : {formatMoney(declared)}</span>}
                {due !== null && due > 0 && <span className="rounded-full bg-alert-bg px-3 py-1 text-alert-text">Reste : {formatMoney(due)}</span>}
                {due === 0 && declared === 0 && <span className="rounded-full bg-ok-bg px-3 py-1 text-ok-text">À jour, merci !</span>}
              </p>
              {declared > 0 && (
                <p role="status" className="rounded-2xl bg-warn-bg px-3 py-2 text-sm text-warn-text">
                  Merci ! Votre versement est déclaré : la trésorière le vérifie, puis votre reçu arrivera dans vos notifications.
                </p>
              )}
              {(due === null || due > 0) && (
                <details className="rounded-xl bg-cloud px-3">
                  <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-royal">J&apos;ai payé : déclarer mon versement</summary>
                  <DeclareForm
                    headingId={h.id}
                    methods={methods}
                    suggested={due || h.min_amount}
                    periods={h.recurrence === "monthly" ? periods : undefined}
                  />
                </details>
              )}
            </Card>
          );
        })}
      </section>

      {myReceipts.length > 0 && (
        <section className="flex flex-col gap-2" aria-labelledby="recus">
          <h2 id="recus" className="text-lg font-semibold">Mes reçus</h2>
          <ul className="flex flex-col divide-y divide-line rounded-card bg-surface px-4 shadow-card">
            {myReceipts.map((r) => (
              <li key={r.id}>
                <Link href={`/cotisations/recu/${r.id}`} className="flex min-h-14 items-center gap-3">
                  <Receipt aria-hidden className="size-5 shrink-0 text-royal" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{r.title}</span>
                    <span className="block text-sm text-muted">
                      N° {r.receipt_no} · {formatFullDate(r.created_at)}
                    </span>
                  </span>
                  <span className="font-semibold">{formatMoney(r.amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
