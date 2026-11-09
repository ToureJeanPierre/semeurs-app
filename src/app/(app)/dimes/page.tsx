import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { ActionForm } from "@/components/people/ActionForm";
import { Card } from "@/components/ui/Card";
import { FilterChips } from "@/components/ui/FilterChips";
import { PrintButton } from "@/components/ui/PrintButton";
import { TextField } from "@/components/ui/TextField";
import { requirePermission } from "@/lib/access";
import { personName } from "@/lib/admin";
import { formatMoney, formatShortDay, todayIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { confirmTithe } from "./actions";

export const metadata: Metadata = { title: "Dîmes" };

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

type Tithe = {
  id: string;
  amount: number;
  tithe_date: string;
  method: string;
  reference: string | null;
  anonymous: boolean;
  status: "pending" | "received" | "not_received";
  people: { first_name: string; last_name: string } | null;
};

/**
 * Les dîmes : visibles du PASTEUR SEUL (décision de Jean-Pierre du 09/11/2026), garanti par la base
 * (droit `tithes.view` du seul rôle Pasteur). À confirmer, liste de l'année, bilan mensuel imprimable.
 */
export default async function TithesPage({ searchParams }: PageProps<"/dimes">) {
  await requirePermission("tithes.view");
  const year = Number((await searchParams).annee) || Number(todayIso().slice(0, 4));
  const supabase = await createClient();
  const [{ data }, { data: report }] = await Promise.all([
    supabase
      .from("tithes")
      .select("id, amount, tithe_date, method, reference, anonymous, status, people(first_name, last_name)")
      .gte("tithe_date", `${year}-01-01`)
      .lte("tithe_date", `${year}-12-31`)
      .order("tithe_date", { ascending: false }),
    supabase.rpc("tithe_report", { p_year: year }),
  ]);
  const rows = (data ?? []) as unknown as Tithe[];
  const pending = rows.filter((t) => t.status === "pending");
  const received = rows.filter((t) => t.status === "received");
  const months = (report ?? []) as { month: number; received: number; pending: number; givers: number }[];
  const total = months.reduce((s, m) => s + Number(m.received), 0);
  const who = (t: Tithe) => (t.anonymous ? "Anonyme" : t.people ? personName(t.people) : "—");

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5 print:max-w-none print:p-0">
      <PageTitle title="Dîmes" intro="Visibles de vous seul : ni la caisse, ni l'administration ne les voient." />
      <p className="flex items-center gap-2 rounded-2xl bg-royal/10 px-4 py-2 text-sm font-semibold text-royal print:hidden">
        <Lock aria-hidden className="size-4" /> Espace réservé au pasteur
      </p>

      <FilterChips
        items={[year - 1, year, year + 1].map((y) => ({ href: `/dimes?annee=${y}`, label: String(y), icon: "calendar-days", active: y === year }))}
        label="Année"
      />

      {pending.length > 0 && (
        <section className="flex flex-col gap-2 print:hidden">
          <h2 className="text-lg font-semibold">À confirmer ({pending.length})</h2>
          {pending.map((t) => (
            <Card key={t.id} className="flex flex-col gap-2 shadow-card">
              <p className="flex items-start justify-between gap-2">
                <span>
                  <span className="block font-semibold">{who(t)}</span>
                  <span className="block text-sm text-muted">
                    {formatShortDay(t.tithe_date)} · {t.method}
                    {t.reference ? ` · réf. ${t.reference}` : ""}
                  </span>
                </span>
                <span className="font-display text-lg font-bold text-royal">{formatMoney(t.amount)}</span>
              </p>
              <ActionForm action={confirmTithe} hidden={{ tithe_id: t.id, received: "1" }} submitLabel="Reçue : confirmer" variant="primary" />
              <details className="rounded-xl bg-cloud px-3">
                <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-alert-text">Je ne l&apos;ai pas reçue</summary>
                <ActionForm action={confirmTithe} hidden={{ tithe_id: t.id, received: "0" }} submitLabel="Marquer non reçue" className="flex flex-col gap-3 pb-3">
                  <TextField label="Note (facultatif)" name="note" />
                </ActionForm>
              </details>
            </Card>
          ))}
        </section>
      )}

      <Card className="flex flex-col gap-3 shadow-card print:shadow-none">
        <h2 className="font-display text-lg font-bold text-night">Bilan des dîmes {year}</h2>
        <p className="font-display text-3xl font-extrabold text-royal">{formatMoney(total)}</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1 font-semibold">Mois</th>
              <th className="py-1 text-right font-semibold">Reçu</th>
              <th className="py-1 text-right font-semibold">Fidèles</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month} className="border-t border-line">
                <td className="py-1.5">{MONTHS[m.month - 1]}</td>
                <td className="py-1.5 text-right font-semibold">{formatMoney(Number(m.received))}</td>
                <td className="py-1.5 text-right">{m.givers}</td>
              </tr>
            ))}
            {months.length === 0 && (
              <tr>
                <td colSpan={3} className="py-1.5 text-muted">
                  Aucune dîme cette année.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {received.length > 0 && (
        <details className="rounded-card bg-surface px-4 shadow-card print:block">
          <summary className="flex min-h-12 cursor-pointer items-center font-display font-bold text-night">Détail des dîmes reçues ({received.length})</summary>
          <ul className="flex flex-col divide-y divide-line pb-3 text-sm">
            {received.map((t) => (
              <li key={t.id} className="flex justify-between gap-2 py-2">
                <span>
                  {formatShortDay(t.tithe_date)} · {who(t)}
                </span>
                <span className="font-semibold">{formatMoney(t.amount)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <PrintButton label="Imprimer le bilan des dîmes" />
    </div>
  );
}
