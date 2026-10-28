import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentHeader } from "@/components/contributions/ReceiptHeader";
import { Card } from "@/components/ui/Card";
import { PrintButton } from "@/components/ui/PrintButton";
import { personName } from "@/lib/admin";
import { byMethod, collected, summarize, type Heading, type MemberStatus, type Payment } from "@/lib/contributions";
import { formatFullDate, formatMoney, formatShortDay, todayIso } from "@/lib/format";
import { loadValueList } from "@/lib/people";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Bilan de cotisation" };

/** Bilan imprimable (PDF par le navigateur) : totaux, moyens de paiement, versements, retardataires. */
export default async function ContributionReportPage({ params }: PageProps<"/cotisations/[id]/bilan">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: heading } = await supabase.from("contribution_headings").select("*").eq("id", id).maybeSingle();
  if (!heading) notFound();
  const h = heading as Heading;
  const [{ data: payments }, statusRes, methods, { data: profile }, { data: group }] = await Promise.all([
    supabase
      .from("contribution_payments")
      .select("*, people!contribution_payments_person_id_fkey(first_name, last_name)")
      .eq("heading_id", id)
      .eq("status", "validated")
      .order("created_at"),
    supabase.rpc("contribution_status", { p_heading: id, p_period: null }),
    loadValueList("payment_method"),
    supabase.from("settings").select("value").eq("key", "church_profile").maybeSingle(),
    h.group_id ? supabase.from("groups").select("name").eq("id", h.group_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (statusRes.error) notFound(); // réservé à qui suit la cotisation
  const rows = (payments ?? []) as (Payment & { people: { first_name: string; last_name: string } | null })[];
  const members = (statusRes.data ?? []) as MemberStatus[];
  const total = collected(rows);
  const methodsTotals = byMethod(rows);
  const sum = summarize(members);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-8 pt-5 print:max-w-none print:p-0">
      <Card className="flex flex-col gap-4 shadow-card print:shadow-none">
        <DocumentHeader profile={(profile?.value ?? {}) as object} />
        <div>
          <h1 className="font-display text-2xl font-extrabold">Bilan : {h.title}</h1>
          <p className="text-sm text-muted">
            {group?.name ?? "Toute l'église"} · lancée le {formatFullDate(h.starts_on)}
            {h.status === "closed" ? " · clôturée" : ` · état au ${formatFullDate(todayIso())}`}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          {[
            ["Encaissé", formatMoney(total)],
            ["Objectif", h.target_amount ? formatMoney(h.target_amount) : "—"],
            ["Versements", String(rows.filter((r) => r.amount > 0).length)],
            ["À jour", `${sum.paid} / ${members.length}`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-cloud p-3">
              <p className="text-xs text-muted">{label}</p>
              <p className="font-bold">{value}</p>
            </div>
          ))}
        </div>
        <section>
          <h2 className="mb-1 font-semibold">Par moyen de paiement</h2>
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(methodsTotals).map(([m, amount]) => (
                <tr key={m} className="border-b border-line">
                  <td className="py-1">{methods.find((x) => x.value === m)?.label ?? m}</td>
                  <td className="py-1 text-right font-semibold">{formatMoney(amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section>
          <h2 className="mb-1 font-semibold">Versements</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="py-1 font-normal">Date</th>
                <th className="py-1 font-normal">Nom</th>
                <th className="py-1 font-normal">Reçu</th>
                <th className="py-1 text-right font-normal">Montant</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line">
                  <td className="py-1">{formatShortDay(r.created_at)}</td>
                  <td className="py-1">{r.people ? personName(r.people) : ""}{r.amount < 0 ? " (annulation)" : ""}</td>
                  <td className="py-1">{r.receipt_no}</td>
                  <td className="py-1 text-right font-semibold">{formatMoney(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        {sum.unpaid + sum.partial > 0 && (
          <section>
            <h2 className="mb-1 font-semibold">Pas encore à jour ({sum.unpaid + sum.partial})</h2>
            <p className="text-sm">{members.filter((m) => m.state !== "paid").map((m) => m.name).join(", ")}</p>
          </section>
        )}
      </Card>
      <PrintButton />
    </div>
  );
}
