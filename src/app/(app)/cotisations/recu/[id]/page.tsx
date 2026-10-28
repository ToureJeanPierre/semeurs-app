import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentHeader } from "@/components/contributions/ReceiptHeader";
import { Card } from "@/components/ui/Card";
import { PrintButton } from "@/components/ui/PrintButton";
import { personName } from "@/lib/admin";
import { amountInWords } from "@/lib/contributions";
import { formatFullDate, formatMoney, formatMonth } from "@/lib/format";
import { loadValueList } from "@/lib/people";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reçu" };

type Row = {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  period: string | null;
  receipt_no: string | null;
  validated_at: string | null;
  people: { first_name: string; last_name: string } | null;
  contribution_headings: { title: string } | null;
};

/** Reçu numérique numéroté, visible du payeur et de qui suit la cotisation (RLS). */
export default async function ReceiptPage({ params }: PageProps<"/cotisations/recu/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data }, { data: profile }, methods] = await Promise.all([
    supabase
      .from("contribution_payments")
      .select("id, amount, method, reference, period, receipt_no, validated_at, people!contribution_payments_person_id_fkey(first_name, last_name), contribution_headings(title)")
      .eq("id", id)
      .eq("status", "validated")
      .gt("amount", 0)
      .maybeSingle(),
    supabase.from("settings").select("value").eq("key", "church_profile").maybeSingle(),
    loadValueList("payment_method"),
  ]);
  if (!data) notFound();
  const r = data as unknown as Row;
  const { count: reversed } = await supabase.from("contribution_payments").select("id", { count: "exact", head: true }).eq("reverses_id", id);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5 print:max-w-none print:p-0">
      <Card className="flex flex-col gap-4 shadow-card print:shadow-none">
        <DocumentHeader profile={(profile?.value ?? {}) as object} />
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="font-display text-2xl font-extrabold">Reçu</h1>
          <p className="font-semibold">N° {r.receipt_no}</p>
        </div>
        {Boolean(reversed) && (
          <p className="rounded-2xl bg-alert-bg px-3 py-2 text-center font-bold text-alert-text">ANNULÉ (contre-opération enregistrée)</p>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted">Reçu de</dt>
          <dd className="font-semibold">{r.people ? personName(r.people) : ""}</dd>
          <dt className="text-muted">Pour</dt>
          <dd className="font-semibold">
            {r.contribution_headings?.title}
            {r.period ? ` (${formatMonth(`${r.period}-01`)})` : ""}
          </dd>
          <dt className="text-muted">Montant</dt>
          <dd>
            <span className="font-display text-xl font-bold text-royal">{formatMoney(r.amount)}</span>
            <span className="block first-letter:uppercase">{amountInWords(r.amount)} francs CFA</span>
          </dd>
          <dt className="text-muted">Moyen</dt>
          <dd>
            {methods.find((m) => m.value === r.method)?.label ?? r.method}
            {r.reference ? ` · réf. ${r.reference}` : ""}
          </dd>
          <dt className="text-muted">Date</dt>
          <dd>{r.validated_at ? formatFullDate(r.validated_at) : ""}</dd>
        </dl>
        <p className="border-t border-line pt-3 text-center text-sm text-muted">
          « Que chacun donne comme il l&apos;a résolu en son cœur, car Dieu aime celui qui donne avec joie. » 2 Corinthiens 9.7
        </p>
      </Card>
      <PrintButton />
    </div>
  );
}
