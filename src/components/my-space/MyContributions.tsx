import Link from "next/link";
import { ChevronRight, Wallet } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { collected, recentPeriods, remaining } from "@/lib/contributions";
import { formatMoney, todayIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Row = {
  id: string;
  title: string;
  group_id: string | null;
  status: string;
  amount: number | null;
  amount_mode: string;
  recurrence: string;
  beneficiary_id: string | null;
  contribution_payments: { person_id: string; amount: number; status: "declared" | "validated" | "rejected"; period: string | null }[];
};

/** Mon espace : les cotisations en cours qui me concernent, ce que j'ai versé et ce qui reste. */
export async function MyContributions({ personId }: { personId: string }) {
  const supabase = await createClient();
  const [{ data }, { data: myGroups }] = await Promise.all([
    supabase
      .from("contribution_headings")
      .select("id, title, group_id, status, amount, amount_mode, recurrence, beneficiary_id, contribution_payments(person_id, amount, status, period)")
      .eq("status", "open"),
    supabase.rpc("my_groups"),
  ]);
  const mine = new Set(((myGroups ?? []) as { id: string }[]).map((g) => g.id));
  const period = recentPeriods(todayIso(), 1)[0];
  const rows = ((data ?? []) as Row[]).filter((h) => h.beneficiary_id !== personId && (h.group_id === null || mine.has(h.group_id)));
  if (rows.length === 0) return null;
  return (
    <Card className="flex flex-col gap-2 shadow-card">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Wallet aria-hidden className="size-5 text-royal" /> Mes cotisations en cours
      </h2>
      <ul className="flex flex-col divide-y divide-line">
        {rows.map((h) => {
          const pays = h.contribution_payments.filter((p) => p.person_id === personId && (h.recurrence !== "monthly" || p.period === period));
          const paid = collected(pays);
          const due = h.amount_mode === "fixed" ? remaining(h.amount, paid) : null;
          return (
            <li key={h.id}>
              <Link href="/cotisations" className="flex min-h-14 items-center gap-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{h.title}</span>
                  <span className="block text-sm text-muted">
                    {paid > 0 ? `Versé : ${formatMoney(paid)}` : "Rien versé pour l'instant"}
                    {h.recurrence === "monthly" ? " ce mois-ci" : ""}
                  </span>
                </span>
                {due !== null && (
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${due > 0 ? "bg-warn-bg text-warn-text" : "bg-ok-bg text-ok-text"}`}>
                    {due > 0 ? `Reste ${formatMoney(due)}` : "À jour ✓"}
                  </span>
                )}
                <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
