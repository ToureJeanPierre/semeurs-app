import { DocumentHeader } from "@/components/contributions/ReceiptHeader";
import { Card } from "@/components/ui/Card";
import { PrintButton } from "@/components/ui/PrintButton";
import { amountInWords } from "@/lib/contributions";
import { formatFullDate, formatMoney, todayIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

/** Attestation annuelle des dîmes et dons nominatifs d'une personne (imprimable / PDF). */
export async function TitheCertificate({ personId, name, year }: { personId: string; name: string; year: number }) {
  const supabase = await createClient();
  const [{ data }, { data: profile }] = await Promise.all([
    supabase
      .from("cash_operations")
      .select("op_date, amount, category, receipt_no")
      .eq("person_id", personId)
      .eq("status", "approved")
      .eq("direction", "in")
      .eq("anonymous", false)
      .in("category", ["tithe", "gift", "thanksgiving", "pledge"])
      .gte("op_date", `${year}-01-01`)
      .lte("op_date", `${year}-12-31`)
      .order("op_date"),
    supabase.from("settings").select("value").eq("key", "church_profile").maybeSingle(),
  ]);
  const rows = (data ?? []) as { op_date: string; amount: number; category: string; receipt_no: string | null }[];
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const tithes = rows.filter((r) => r.category === "tithe").reduce((s, r) => s + r.amount, 0);
  return (
    <>
      <Card className="flex flex-col gap-4 shadow-card print:shadow-none">
        <DocumentHeader profile={(profile?.value ?? {}) as object} />
        <h1 className="font-display text-2xl font-extrabold">Attestation de dons {year}</h1>
        <p>
          L&apos;Église évangélique Les Semeurs de la Parole atteste que <span className="font-semibold">{name}</span> a remis au cours de
          l&apos;année {year} la somme de <span className="font-semibold">{formatMoney(total)}</span> (
          <span className="first-letter:lowercase">{amountInWords(total)}</span> francs CFA), dont {formatMoney(tithes)} de dîmes.
        </p>
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-line">
                <td className="py-1">{formatFullDate(r.op_date)}</td>
                <td className="py-1">{r.category === "tithe" ? "Dîme" : r.category === "pledge" ? "Engagement" : "Don"}</td>
                <td className="py-1 text-muted">{r.receipt_no}</td>
                <td className="py-1 text-right font-semibold">{formatMoney(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-sm text-muted">Fait à Abidjan, le {formatFullDate(todayIso())}.</p>
      </Card>
      <PrintButton />
    </>
  );
}
