import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PageTitle } from "@/components/admin/AdminCard";
import { DocumentHeader } from "@/components/contributions/ReceiptHeader";
import { Card } from "@/components/ui/Card";
import { FilterChips } from "@/components/ui/FilterChips";
import { PrintButton } from "@/components/ui/PrintButton";
import { hasAny, requirePermission } from "@/lib/access";
import { monthBounds } from "@/lib/cash";
import { loadCashLabels } from "@/lib/cash-server";
import { formatFullDate, formatMoney, formatMonth, formatShortDay, todayIso } from "@/lib/format";
import { loadValueList } from "@/lib/people";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Bilans" };

type Activity = {
  worship: { sessions: number; attendance: number; average: number; list: { date: string; title: string; present: number }[] };
  groups: { sessions: number; reports: number; present: number; newcomers: number };
  souls: { arrived: number; still_following: number; integrated: number };
  outreach: { outings: number; contacts: number; accepted: number; came: number };
  care: { follow_ups: number; audiences: number; life_events: Record<string, number>; alerts_now: number };
  meetings: { held: number; planned: number; cancelled: number };
  trainings: { enrolled: number; completed: number };
  acts: Record<string, number>;
  messages: number;
  contributions: number;
  programme: {
    services: { date: string; title: string }[];
    events: { date: string; title: string; registered: number }[];
    meetings: { date: string; title: string; status: string }[];
  };
};
type Finance = {
  opening: number;
  closing: number;
  income: { category: string; amount: number }[];
  expense: { category: string; amount: number }[];
  pending: number;
  contributions: number;
};

/** Période choisie : un mois (« 2026-10 ») ou une année (« 2026 »). */
function period(kind: string, value: string | undefined, today: string) {
  if (kind === "annee") {
    const year = /^\d{4}$/.test(value ?? "") ? value! : today.slice(0, 4);
    return { kind, value: year, from: `${year}-01-01`, to: `${year}-12-31`, label: `Année ${year}` };
  }
  const month = /^\d{4}-\d{2}$/.test(value ?? "") ? value! : today.slice(0, 7);
  const { first, last } = monthBounds(month);
  const label = formatMonth(first);
  return { kind: "mois", value: month, from: first, to: last, label: label.charAt(0).toUpperCase() + label.slice(1) };
}

function shift(kind: string, value: string, step: number): string {
  if (kind === "annee") return String(Number(value) + step);
  const [y, m] = value.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + step, 1));
  return d.toISOString().slice(0, 7);
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl bg-[#eef5ff] p-3 text-center print:border print:border-line print:bg-white">
      <p className="font-display text-2xl font-extrabold text-royal">{value}</p>
      <p className="text-xs font-medium text-ink/70">{label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="flex break-inside-avoid flex-col gap-3 shadow-card print:shadow-none">
      <h2 className="font-display text-lg font-bold text-night">{title}</h2>
      {children}
    </Card>
  );
}

/**
 * Bilans imprimables du mois ou de l'année : activité de l'église (cultes, groupes, âmes,
 * évangélisation, suivi, réunions, formations, actes), programme de la période et, pour qui a
 * le droit caisse, bilan financier. Les chiffres viennent des fonctions activity_report et finance_report.
 */
export default async function ReportsPage({ searchParams }: PageProps<"/bilans">) {
  const access = await requirePermission("reports.view");
  const params = await searchParams;
  const today = todayIso();
  const p = period(String(params.periode ?? "mois"), params.v ? String(params.v) : undefined, today);
  const finance = hasAny(access, ["cash.view", "cash.approve", "cash.manage"]);
  const supabase = await createClient();
  const [{ data: a }, fin, actKinds, lifeKinds, labels, { data: profile }] = await Promise.all([
    supabase.rpc("activity_report", { p_from: p.from, p_to: p.to }),
    finance ? supabase.rpc("finance_report", { p_from: p.from, p_to: p.to }) : Promise.resolve({ data: null }),
    loadValueList("act_kind"),
    loadValueList("life_event_kind"),
    finance ? loadCashLabels() : Promise.resolve(null),
    supabase.from("settings").select("value").eq("key", "church_profile").maybeSingle(),
  ]);
  const r = a as Activity | null;
  const f = (fin?.data ?? null) as Finance | null;
  const label = (list: { value: string; label: string }[], v: string) => list.find((x) => x.value === v)?.label ?? v;
  const totalIn = (f?.income ?? []).reduce((s, x) => s + Number(x.amount), 0);
  const totalOut = (f?.expense ?? []).reduce((s, x) => s + Number(x.amount), 0);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5 print:max-w-none print:p-0">
      <PageTitle title="Bilans" intro="Le bilan du mois ou de l'année, prêt à imprimer ou à enregistrer en PDF." />

      <div className="flex flex-col gap-3 print:hidden">
        <FilterChips
          items={[
            { href: "/bilans?periode=mois", label: "Bilan du mois", icon: "calendar-days", active: p.kind === "mois" },
            { href: "/bilans?periode=annee", label: "Bilan de l'année", icon: "clipboard-list", active: p.kind === "annee" },
          ]}
        />
        <div className="flex items-center justify-between gap-2 rounded-card bg-surface p-2 shadow-card">
          <a href={`/bilans?periode=${p.kind}&v=${shift(p.kind, p.value, -1)}`} className="grid size-11 place-items-center rounded-full bg-royal/10 text-xl font-bold text-royal" aria-label="Période précédente">
            ‹
          </a>
          <p className="font-display text-lg font-bold text-night">{p.label}</p>
          <a href={`/bilans?periode=${p.kind}&v=${shift(p.kind, p.value, 1)}`} className="grid size-11 place-items-center rounded-full bg-royal/10 text-xl font-bold text-royal" aria-label="Période suivante">
            ›
          </a>
        </div>
        <PrintButton label="Imprimer ou enregistrer le bilan en PDF" />
      </div>

      <div className="hidden print:block">
        <DocumentHeader profile={(profile?.value ?? {}) as object} />
        <h1 className="mt-4 font-display text-2xl font-extrabold">Bilan · {p.label}</h1>
        <p className="text-sm">
          Du {formatFullDate(p.from)} au {formatFullDate(p.to)} · établi le {formatFullDate(today)}
        </p>
      </div>

      {!r ? (
        <p className="rounded-card bg-surface p-4 text-muted">Le bilan n&apos;a pas pu être calculé.</p>
      ) : (
        <>
          <Section title="Cultes et présences">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Cultes pointés" value={r.worship.sessions} />
              <Stat label="Présences" value={r.worship.attendance} />
              <Stat label="Moyenne par culte" value={r.worship.average} />
            </div>
            {r.worship.list.length > 0 && (
              <ul className="flex flex-col divide-y divide-line text-sm">
                {r.worship.list.map((w, i) => (
                  <li key={i} className="flex justify-between gap-2 py-1.5">
                    <span>
                      {formatShortDay(w.date)} · {w.title}
                    </span>
                    <span className="font-semibold">{w.present} présents</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Familles, équipes et cellules">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Rencontres pointées" value={r.groups.sessions} />
              <Stat label="Rapports de cellule" value={r.groups.reports} />
              <Stat label="Présents (rapports)" value={r.groups.present} />
              <Stat label="Nouveaux venus (rapports)" value={r.groups.newcomers} />
            </div>
          </Section>

          <Section title="Nouvelles âmes et évangélisation">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Arrivées" value={r.souls.arrived} />
              <Stat label="Intégrées en famille" value={r.souls.integrated} />
              <Stat label="Encore suivies" value={r.souls.still_following} />
              <Stat label="Sorties" value={r.outreach.outings} />
              <Stat label="Personnes rencontrées" value={r.outreach.contacts} />
              <Stat label="Ont accepté Jésus" value={r.outreach.accepted} />
            </div>
            <p className="text-sm text-ink/75">Parmi les personnes rencontrées, {r.outreach.came} sont venues à l&apos;église.</p>
          </Section>

          <Section title="Suivi pastoral">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Contacts de suivi" value={r.care.follow_ups} />
              <Stat label="Audiences" value={r.care.audiences} />
              <Stat label="Alertes urgentes (ce jour)" value={r.care.alerts_now} />
            </div>
            {Object.keys(r.care.life_events).length > 0 && (
              <p className="text-sm">
                Événements de vie :{" "}
                {Object.entries(r.care.life_events)
                  .map(([k, n]) => `${label(lifeKinds, k)} (${n})`)
                  .join(", ")}
              </p>
            )}
          </Section>

          <Section title="Réunions, formations, actes, messages">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Réunions tenues" value={r.meetings.held} />
              <Stat label="Réunions prévues" value={r.meetings.planned} />
              <Stat label="Annulées" value={r.meetings.cancelled} />
              <Stat label="Inscrits en formation" value={r.trainings.enrolled} />
              <Stat label="Formations terminées" value={r.trainings.completed} />
              <Stat label="Messages envoyés" value={r.messages} />
            </div>
            <p className="text-sm">
              Actes :{" "}
              {Object.keys(r.acts).length === 0
                ? "aucun"
                : Object.entries(r.acts)
                    .map(([k, n]) => `${label(actKinds, k)} (${n})`)
                    .join(", ")}
              . Cotisations reçues : <span className="font-semibold">{formatMoney(r.contributions)}</span>.
            </p>
          </Section>

          <Section title="Programme de la période">
            {r.programme.services.length + r.programme.events.length + r.programme.meetings.length === 0 && (
              <p className="text-sm text-muted">Rien de programmé sur cette période.</p>
            )}
            <ul className="flex flex-col divide-y divide-line text-sm">
              {[
                ...r.programme.services.map((s) => ({ date: s.date, text: s.title, tag: "Culte" })),
                ...r.programme.events.map((e) => ({ date: e.date, text: `${e.title}${e.registered ? ` · ${e.registered} inscrits` : ""}`, tag: "Événement" })),
                ...r.programme.meetings.map((m) => ({
                  date: m.date,
                  text: `${m.title}${m.status === "held" ? " · tenue" : m.status === "cancelled" ? " · annulée" : ""}`,
                  tag: "Réunion",
                })),
              ]
                .sort((x, y) => x.date.localeCompare(y.date))
                .map((i, k) => (
                  <li key={k} className="flex items-start justify-between gap-2 py-1.5">
                    <span>
                      {formatShortDay(i.date)} · {i.text}
                    </span>
                    <span className="shrink-0 rounded-full bg-[#eef5ff] px-2 py-0.5 text-xs font-semibold text-royal">{i.tag}</span>
                  </li>
                ))}
            </ul>
          </Section>
        </>
      )}

      {f && labels && (
        <Section title="Bilan financier">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Solde au début" value={formatMoney(f.opening)} />
            <Stat label="Solde à la fin" value={formatMoney(f.closing)} />
            <Stat label="Recettes" value={formatMoney(totalIn)} />
            <Stat label="Dépenses" value={formatMoney(totalOut)} />
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1 font-semibold">Recettes</th>
                <th className="py-1 text-right font-semibold">Montant</th>
              </tr>
            </thead>
            <tbody>
              {f.income.map((x) => (
                <tr key={x.category} className="border-t border-line">
                  <td className="py-1.5">{labels.category("in", x.category)}</td>
                  <td className="py-1.5 text-right font-semibold">{formatMoney(Number(x.amount))}</td>
                </tr>
              ))}
              {f.income.length === 0 && (
                <tr>
                  <td colSpan={2} className="py-1.5 text-muted">
                    Aucune recette validée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1 font-semibold">Dépenses</th>
                <th className="py-1 text-right font-semibold">Montant</th>
              </tr>
            </thead>
            <tbody>
              {f.expense.map((x) => (
                <tr key={x.category} className="border-t border-line">
                  <td className="py-1.5">{labels.category("out", x.category)}</td>
                  <td className="py-1.5 text-right font-semibold">{formatMoney(Number(x.amount))}</td>
                </tr>
              ))}
              {f.expense.length === 0 && (
                <tr>
                  <td colSpan={2} className="py-1.5 text-muted">
                    Aucune dépense validée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="text-sm">
            Résultat de la période : <span className="font-semibold">{formatMoney(totalIn - totalOut)}</span>. Cotisations de familles et
            groupes reçues : {formatMoney(f.contributions)}.
            {f.pending > 0 && ` ${f.pending} opération${f.pending > 1 ? "s" : ""} encore en attente de validation (non comptées).`}
          </p>
        </Section>
      )}

      <div className="hidden pt-6 text-sm print:grid print:grid-cols-2">
        <p>Le Pasteur</p>
        {f && <p>Le Trésorier / la Trésorière</p>}
      </div>
    </div>
  );
}
