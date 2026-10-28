import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck, FileText, MessageCircle, Receipt } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { PersonPicker } from "@/components/admin/PersonPicker";
import { ProgressBar } from "@/components/contributions/ProgressBar";
import { ActionForm } from "@/components/people/ActionForm";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { getAccess, hasAny } from "@/lib/access";
import { personName } from "@/lib/admin";
import { fillTemplate, whatsappHref } from "@/lib/contact-links";
import { collected, recentPeriods, reversedIds, summarize, type Heading, type MemberStatus, type Payment } from "@/lib/contributions";
import { formatFullDate, formatMoney, formatMonth, formatShortDay, todayIso } from "@/lib/format";
import { loadMessageTemplate } from "@/lib/message-templates";
import { loadValueList } from "@/lib/people";
import { createClient } from "@/lib/supabase/server";
import { closeHeading, recordPayment, rejectPayment, remindLate, reversePayment, validatePayment } from "../actions";

export const metadata: Metadata = { title: "Suivi de la cotisation" };

type PaymentRow = Payment & { people: { first_name: string; last_name: string } | null };

const STATE = {
  paid: { label: "À jour", cls: "bg-ok-bg text-ok-text" },
  partial: { label: "En partie", cls: "bg-warn-bg text-warn-text" },
  unpaid: { label: "Pas encore", cls: "bg-alert-bg text-alert-text" },
} as const;

/** Suivi d'une cotisation : à valider, qui a payé, saisie, relances, annulations, clôture. */
export default async function ContributionPage({ params, searchParams }: PageProps<"/cotisations/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: heading } = await supabase.from("contribution_headings").select("*").eq("id", id).maybeSingle();
  if (!heading) notFound();
  const h = heading as Heading;
  const today = todayIso();
  const periods = recentPeriods(today, 6);
  const period = typeof query.mois === "string" && periods.includes(query.mois) ? query.mois : periods[0];

  const access = await getAccess();
  const [{ data: payments }, statusRes, methods, kinds, { data: manageGroups }, template, { data: group }, { data: beneficiary }] = await Promise.all([
    supabase.from("contribution_payments").select("*, people!contribution_payments_person_id_fkey(first_name, last_name)").eq("heading_id", id).order("created_at", { ascending: false }),
    supabase.rpc("contribution_status", { p_heading: id, p_period: h.recurrence === "monthly" ? period : null }),
    loadValueList("payment_method"),
    loadValueList("contribution_kind"),
    supabase.rpc("my_groups_with", { p_permission: "contributions.manage" }),
    loadMessageTemplate("contribution_reminder", "Bonjour {prénom}, petit rappel pour la cotisation « {cotisation} »."),
    h.group_id ? supabase.from("groups").select("name").eq("id", h.group_id).maybeSingle() : Promise.resolve({ data: null }),
    h.beneficiary_id ? supabase.from("people").select("first_name, last_name").eq("id", h.beneficiary_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const rows = (payments ?? []) as PaymentRow[];
  const follows = !statusRes.error;
  const members = (statusRes.data ?? []) as MemberStatus[];
  const manager = h.group_id
    ? ((manageGroups ?? []) as { id: string }[]).some((g) => g.id === h.group_id)
    : hasAny(access, ["contributions.manage"]);
  const open = h.status === "open";
  const reversed = reversedIds(rows);
  const declared = rows.filter((p) => p.status === "declared");
  const history = rows.filter((p) => p.status !== "declared" && (h.recurrence !== "monthly" || p.period === period || p.reverses_id));
  const total = collected(rows.filter((p) => h.recurrence !== "monthly" || p.period === period));
  const sum = summarize(members);
  const methodLabel = (m: string) => methods.find((x) => x.value === m)?.label ?? m;
  const late = members.filter((m) => m.state !== "paid");

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pb-8 pt-5">
      {query.lancee === "1" && (
        <p role="status" className="flex items-start gap-2 rounded-2xl bg-ok-bg px-4 py-3 font-medium text-ok-text">
          <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0" />
          Cotisation lancée : elle apparaît chez chaque membre concerné, qui peut déclarer son versement.
        </p>
      )}
      <PageTitle
        title={h.title}
        intro={`${kinds.find((k) => k.value === h.kind)?.label ?? h.kind} · ${group?.name ?? "Toute l'église"}${beneficiary ? ` · pour ${personName(beneficiary)}` : ""}${h.status === "closed" ? " · clôturée" : ""}`}
      />

      <Card className="flex flex-col gap-3 shadow-card">
        <ProgressBar total={total} target={h.target_amount} />
        <p className="text-sm text-muted">
          {h.amount_mode === "fixed" ? `${formatMoney(h.amount!)} par personne` : "Montant libre"}
          {h.recurrence === "monthly" ? ` · chaque mois (${formatMonth(`${period}-01`)})` : ""}
          {h.due_date ? ` · échéance le ${formatFullDate(h.due_date)}` : ""}
        </p>
        {follows && (
          <ul className="flex flex-wrap gap-2 text-sm font-semibold">
            <li className="rounded-full bg-ok-bg px-3 py-1 text-ok-text">{sum.paid} à jour</li>
            {sum.partial > 0 && <li className="rounded-full bg-warn-bg px-3 py-1 text-warn-text">{sum.partial} en partie</li>}
            <li className="rounded-full bg-alert-bg px-3 py-1 text-alert-text">{sum.unpaid} pas encore</li>
          </ul>
        )}
        {h.recurrence === "monthly" && (
          <form className="flex items-end gap-2" action={`/cotisations/${id}`}>
            <SelectField label="Mois" name="mois" defaultValue={period} options={periods.map((p) => ({ value: p, label: formatMonth(`${p}-01`) }))} className="flex-1" />
            <button type="submit" className="min-h-13 rounded-2xl bg-royal/10 px-4 font-semibold text-royal">
              Voir
            </button>
          </form>
        )}
        <Link href={`/cotisations/${id}/bilan`} className="flex min-h-11 items-center gap-2 font-semibold text-royal">
          <FileText aria-hidden className="size-5" /> Bilan à imprimer (PDF)
        </Link>
      </Card>

      {manager && declared.length > 0 && (
        <section className="flex flex-col gap-2" aria-labelledby="valider">
          <h2 id="valider" className="text-lg font-semibold">À valider</h2>
          <p className="text-sm text-muted">Vérifiez la référence dans votre historique Mobile Money avant de valider.</p>
          {declared.map((p) => (
            <Card key={p.id} className="flex flex-col gap-2 shadow-card">
              <p className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{p.people ? personName(p.people) : ""}</span>
                <span className="font-display text-lg font-bold">{formatMoney(p.amount)}</span>
              </p>
              <p className="text-sm text-muted">
                {methodLabel(p.method)}
                {p.reference ? ` · réf. ${p.reference}` : ""} · déclaré le {formatShortDay(p.created_at)}
                {p.period ? ` · ${formatMonth(`${p.period}-01`)}` : ""}
              </p>
              <form action={validatePayment}>
                <input type="hidden" name="payment_id" value={p.id} />
                <SubmitButton className="min-h-11 w-full rounded-full bg-ok-ring font-semibold text-white">Valider et envoyer le reçu</SubmitButton>
              </form>
              <details className="rounded-xl bg-cloud px-3">
                <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-alert-text">Refuser (référence introuvable…)</summary>
                <ActionForm action={rejectPayment} hidden={{ payment_id: p.id }} submitLabel="Refuser la déclaration" className="flex flex-col gap-3 pb-3">
                  <TextField label="Motif" name="reason" placeholder="Référence introuvable" required />
                </ActionForm>
              </details>
            </Card>
          ))}
        </section>
      )}

      {manager && open && (
        <Card className="flex flex-col gap-3 shadow-card">
          <h2 className="text-lg font-semibold">Enregistrer un versement</h2>
          <ActionForm action={recordPayment} hidden={{ heading_id: id }} submitLabel="Enregistrer et donner le reçu" variant="primary">
            <PersonPicker name="person_id" label="Qui a payé" people={members.map((m) => ({ id: m.person_id, name: m.name, detail: STATE[m.state].label }))} />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Montant (FCFA)" name="amount" inputMode="numeric" defaultValue={h.amount ? String(h.amount) : ""} required />
              <SelectField label="Moyen" name="method" options={methods} />
            </div>
            <TextField label="Référence (Mobile Money)" name="reference" />
            {h.recurrence === "monthly" && <input type="hidden" name="period" value={period} />}
          </ActionForm>
        </Card>
      )}

      {follows && (
        <section className="flex flex-col gap-2" aria-labelledby="qui">
          <h2 id="qui" className="text-lg font-semibold">Qui a payé</h2>
          <ul className="flex flex-col divide-y divide-line rounded-card bg-surface px-4 shadow-card">
            {members.map((m) => (
              <li key={m.person_id} className="flex min-h-14 items-center gap-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{m.name}</span>
                  <span className="block text-sm text-muted">
                    {m.paid ? formatMoney(m.paid) : "—"}
                    {m.declared ? ` · ${formatMoney(m.declared)} à valider` : ""}
                  </span>
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATE[m.state].cls}`}>{STATE[m.state].label}</span>
              </li>
            ))}
            {members.length === 0 && <li className="py-4 text-sm text-muted">Personne n&apos;est attendu pour cette cotisation.</li>}
          </ul>
        </section>
      )}

      {manager && open && late.length > 0 && (
        <Card className="flex flex-col gap-3 shadow-card">
          <h2 className="text-lg font-semibold">Relancer ({late.length})</h2>
          <ActionForm action={remindLate} hidden={{ heading_id: id, period: h.recurrence === "monthly" ? period : "" }} submitLabel="Rappel dans l'appli à tous" />
          <ul className="flex flex-col divide-y divide-line">
            {late
              .filter((m) => m.phone)
              .map((m) => (
                <li key={m.person_id}>
                  <a
                    href={whatsappHref(m.phone!, fillTemplate(template, m.first_name).replaceAll("{cotisation}", h.title))}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-12 items-center gap-3"
                  >
                    <MessageCircle aria-hidden className="size-5 text-[#1f8f4e]" />
                    <span className="flex-1 font-semibold">{m.name}</span>
                    <span className="text-sm text-muted">WhatsApp</span>
                  </a>
                </li>
              ))}
          </ul>
        </Card>
      )}

      {history.length > 0 && (
        <section className="flex flex-col gap-2" aria-labelledby="historique">
          <h2 id="historique" className="text-lg font-semibold">Historique</h2>
          <ul className="flex flex-col gap-2">
            {history.map((p) => (
              <li key={p.id} className="flex flex-col gap-1 rounded-card bg-surface p-3 shadow-card">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{p.people ? personName(p.people) : ""}</span>
                  <span className={`font-semibold ${p.amount < 0 || p.status === "rejected" ? "text-alert-text" : ""} ${reversed.has(p.id) ? "line-through" : ""}`}>
                    {formatMoney(p.amount)}
                  </span>
                </span>
                <span className="text-sm text-muted">
                  {p.status === "rejected" ? "Refusé" : p.amount < 0 ? "Annulation" : methodLabel(p.method)}
                  {p.receipt_no ? ` · n° ${p.receipt_no}` : ""} · {formatShortDay(p.created_at)}
                  {p.reason ? ` · « ${p.reason} »` : ""}
                </span>
                <span className="flex flex-wrap gap-2">
                  {p.receipt_no && p.amount > 0 && (
                    <Link href={`/cotisations/recu/${p.id}`} className="flex min-h-11 items-center gap-1 text-sm font-semibold text-royal">
                      <Receipt aria-hidden className="size-4" /> Reçu
                    </Link>
                  )}
                </span>
                {manager && p.status === "validated" && p.amount > 0 && !reversed.has(p.id) && (
                  <details className="rounded-xl bg-cloud px-3">
                    <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-alert-text">Annuler ce versement</summary>
                    <ActionForm action={reversePayment} hidden={{ payment_id: p.id }} submitLabel="Annuler par une contre-opération" className="flex flex-col gap-3 pb-3">
                      <TextField label="Motif (obligatoire)" name="reason" placeholder="Erreur de saisie : montant" required />
                    </ActionForm>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {manager && open && (
        <Card className="flex flex-col gap-2 shadow-card">
          <h2 className="text-lg font-semibold">Clôturer</h2>
          <p className="text-sm text-muted">Plus aucun versement ne pourra être ajouté. Le bilan reste consultable.</p>
          <ActionForm action={closeHeading} hidden={{ heading_id: id }} submitLabel="Clôturer la cotisation" variant="ghost" />
        </Card>
      )}
    </div>
  );
}
