import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle } from "@/components/admin/AdminCard";
import { Card } from "@/components/ui/Card";
import { requirePermission } from "@/lib/access";
import { rate } from "@/lib/cash";
import { formatHour, formatMoney, formatShortDay } from "@/lib/format";
import { loadValueList } from "@/lib/people";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Vue d'ensemble" };

type Dashboard = {
  members?: { total: number; by_status: Record<string, number> };
  attendance?: { date: string; title: string; present: number }[];
  alerts?: { family: string; attention: number; urgent: number; critical: number; lost: number }[];
  souls?: { open: number; new_this_month: number; without_family: number };
  cells?: { name: string; last_report: string | null; present: number | null }[];
  life_events?: number;
  audiences?: { at: string; status: string; name: string }[];
  finances?: { income: number; expense: number; pending: number };
  pledges?: { promised: number; paid: number };
};

function Tile({ label, value, href, tone = "royal" }: { label: string; value: string | number; href?: string; tone?: "royal" | "alert" | "ok" }) {
  const cls = tone === "alert" ? "text-alert-text" : tone === "ok" ? "text-ok-text" : "text-royal";
  const body = (
    <>
      <p className={`font-display text-2xl font-bold ${cls}`}>{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </>
  );
  return href ? (
    <Link href={href} className="rounded-card bg-surface p-3 text-center shadow-card">{body}</Link>
  ) : (
    <div className="rounded-card bg-surface p-3 text-center shadow-card">{body}</div>
  );
}

/** Vue d'ensemble du pasteur (docs/03 §5.7) ; les indicateurs se choisissent dans les paramètres. */
export default async function DashboardPage() {
  await requirePermission("alerts.view", "cash.view");
  const supabase = await createClient();
  const [{ data }, { data: widgetsSetting }, statuses] = await Promise.all([
    supabase.rpc("pastor_dashboard"),
    supabase.from("settings").select("value").eq("key", "dashboard_widgets").maybeSingle(),
    loadValueList("person_status"),
  ]);
  const d = (data ?? {}) as Dashboard;
  const widgets = new Set((widgetsSetting?.value as string[] | undefined) ?? []);
  const show = (w: keyof Dashboard) => widgets.has(w) && d[w] !== undefined;
  const maxPresent = Math.max(1, ...(d.attendance ?? []).map((a) => a.present));
  const alertsTotal = (d.alerts ?? []).reduce((s, f) => s + f.urgent + f.critical + f.lost, 0);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title="Vue d'ensemble" intro="L'église en un coup d'œil." />

      {show("members") && (
        <div className="grid grid-cols-3 gap-2">
          <Tile label="Membres suivis" value={d.members!.total} href="/fideles" />
          <Tile label="Absents à risque" value={alertsTotal} href="/alertes" tone={alertsTotal ? "alert" : "ok"} />
          {show("souls") ? <Tile label="Âmes en chemin" value={d.souls!.open} href="/ames" /> : <Tile label="Événements de vie" value={d.life_events ?? 0} />}
        </div>
      )}

      {show("attendance") && (d.attendance ?? []).length > 0 && (
        <Card className="flex flex-col gap-2 shadow-card">
          <h2 className="font-semibold">Présences aux derniers cultes</h2>
          <div className="flex h-36 items-end gap-2" role="img" aria-label={`Présences : ${(d.attendance ?? []).map((a) => `${formatShortDay(a.date)} ${a.present}`).join(", ")}`}>
            {(d.attendance ?? []).map((a) => (
              <div key={a.date + a.title} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs font-semibold">{a.present}</span>
                <span className="w-full rounded-t-lg bg-royal" style={{ height: `${Math.max(4, (a.present / maxPresent) * 100)}px` }} />
                <span className="text-[10px] text-muted">{formatShortDay(a.date).split(" ").slice(1).join(" ")}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {show("alerts") && (d.alerts ?? []).length > 0 && (
        <Card className="flex flex-col gap-2 shadow-card">
          <h2 className="font-semibold">Absences par famille</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="py-1 text-left font-normal">Famille</th>
                <th className="py-1 font-normal">Attention</th>
                <th className="py-1 font-normal">Urgent</th>
                <th className="py-1 font-normal">Critique</th>
                <th className="py-1 font-normal">Perdu</th>
              </tr>
            </thead>
            <tbody>
              {(d.alerts ?? []).map((f) => (
                <tr key={f.family} className="border-t border-line text-center">
                  <td className="py-1.5 text-left font-semibold">{f.family}</td>
                  <td>{f.attention || ""}</td>
                  <td className={f.urgent ? "font-semibold text-alert-text" : ""}>{f.urgent || ""}</td>
                  <td className={f.critical ? "font-semibold text-alert-text" : ""}>{f.critical || ""}</td>
                  <td className={f.lost ? "font-semibold text-lost-text" : ""}>{f.lost || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {show("souls") && (
        <div className="grid grid-cols-3 gap-2">
          <Tile label="Nouvelles ce mois" value={d.souls!.new_this_month} href="/ames" />
          <Tile label="Sans famille" value={d.souls!.without_family} href="/ames" tone={d.souls!.without_family ? "alert" : "ok"} />
          <Tile label="Événements de vie" value={d.life_events ?? 0} href="/evenements-de-vie" />
        </div>
      )}

      {show("finances") && (
        <Card className="flex flex-col gap-2 shadow-card">
          <h2 className="font-semibold">Finances du mois</h2>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-2xl bg-ok-bg p-2 text-ok-text">Recettes<p className="font-bold">{formatMoney(d.finances!.income)}</p></div>
            <div className="rounded-2xl bg-alert-bg p-2 text-alert-text">Dépenses<p className="font-bold">{formatMoney(d.finances!.expense)}</p></div>
            <div className="rounded-2xl bg-cloud p-2">Solde du mois<p className="font-bold">{formatMoney(d.finances!.income - d.finances!.expense)}</p></div>
          </div>
          {d.finances!.pending > 0 && (
            <Link href="/caisse" className="text-sm font-semibold text-warn-text">{d.finances!.pending} opération(s) en attente de validation →</Link>
          )}
        </Card>
      )}

      {show("pledges") && d.pledges!.promised > 0 && (
        <Card className="flex flex-col gap-1 shadow-card">
          <h2 className="font-semibold">Engagements</h2>
          <p className="text-sm">
            Promis {formatMoney(d.pledges!.promised)} · encaissé {formatMoney(d.pledges!.paid)} ·{" "}
            <span className="font-semibold">{rate(d.pledges!.paid, d.pledges!.promised)} %</span>
          </p>
        </Card>
      )}

      {show("cells") && (d.cells ?? []).length > 0 && (
        <Card className="flex flex-col gap-1 shadow-card">
          <h2 className="font-semibold">Cellules</h2>
          <ul className="text-sm">
            {(d.cells ?? []).map((c) => (
              <li key={c.name} className="flex min-h-10 items-center justify-between border-t border-line">
                <span>{c.name}</span>
                <span className={c.last_report ? "text-muted" : "font-semibold text-warn-text"}>
                  {c.last_report ? `${formatShortDay(c.last_report)} · ${c.present} présents` : "aucun rapport"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {show("audiences") && (
        <Card className="flex flex-col gap-1 shadow-card">
          <h2 className="font-semibold">Audiences de la semaine</h2>
          {(d.audiences ?? []).length === 0 && <p className="text-sm text-muted">Aucune demande.</p>}
          <ul className="text-sm">
            {(d.audiences ?? []).map((a, i) => (
              <li key={i} className="flex min-h-10 items-center justify-between border-t border-line">
                <span>{a.name}</span>
                <span className="text-muted">
                  {formatShortDay(a.at)} {formatHour(a.at)} · {a.status === "confirmed" ? "confirmée" : "à confirmer"}
                </span>
              </li>
            ))}
          </ul>
          <Link href="/audiences" className="text-sm font-semibold text-royal">Gérer les audiences →</Link>
        </Card>
      )}

      {show("members") && (
        <Card className="flex flex-col gap-1 shadow-card">
          <h2 className="font-semibold">Effectif par statut</h2>
          <ul className="grid grid-cols-2 gap-x-4 text-sm">
            {Object.entries(d.members!.by_status).map(([status, n]) => (
              <li key={status} className="flex justify-between border-t border-line py-1">
                <span>{statuses.find((s) => s.value === status)?.label ?? status}</span>
                <span className="font-semibold">{n}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
