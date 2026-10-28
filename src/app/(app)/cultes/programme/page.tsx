import type { Metadata } from "next";
import { CircleAlert, Repeat2, Trash2 } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { ActionForm } from "@/components/people/ActionForm";
import { PositionSelect } from "@/components/program/PositionSelect";
import { ServiceCard } from "@/components/program/ServiceCard";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { requirePermission } from "@/lib/access";
import { personName } from "@/lib/admin";
import { addDays, formatFullDate, formatShortDay, todayIso } from "@/lib/format";
import { loadProgram, loadProgramSettings } from "@/lib/program";
import { periodEnd } from "@/lib/rotation";
import { createClient } from "@/lib/supabase/server";
import {
  createExceptionalService,
  decideSwap,
  deleteDraftService,
  generateProgram,
  publishProgram,
  setPositionPerson,
} from "../actions";

export const metadata: Metadata = { title: "Préparer le programme" };

type Swap = {
  id: string;
  reason: string | null;
  requester: { first_name: string; last_name: string } | null;
  replacement: { first_name: string; last_name: string } | null;
  service_positions: { position: string; services: { title: string; service_date: string } | null } | null;
};

/** Génération sur 2, 3 ou 6 mois, ajustements à la main, contrôles, publication. */
export default async function ProgramPage({ searchParams }: PageProps<"/cultes/programme">) {
  await requirePermission("program.manage");
  const params = await searchParams;
  const today = todayIso();
  const from = typeof params.du === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.du) ? params.du : today;
  const { positions: programPositions, periods } = await loadProgramSettings();
  const months = Number(params.mois) || periods[1] || 3;
  const to = periodEnd(from, months);

  const supabase = await createClient();
  const [services, { data: pool }, { data: unavailable }, { data: absences }, { data: swaps }, { data: types }] = await Promise.all([
    loadProgram(from, to),
    supabase.from("speaker_pools").select("person_id, position, people(first_name, last_name)"),
    supabase.from("unavailabilities").select("person_id, starts_on, ends_on").gte("ends_on", from),
    supabase.from("excused_absences").select("person_id, starts_on, ends_on").gte("ends_on", from),
    supabase
      .from("swap_requests")
      .select(
        "id, reason, requester:people!swap_requests_requester_id_fkey(first_name, last_name), replacement:people!swap_requests_replacement_id_fkey(first_name, last_name), service_positions(position, services(title, service_date))",
      )
      .eq("status", "pending")
      .order("created_at"),
    supabase.from("service_types").select("id, name").eq("active", true).order("weekday"),
  ]);

  const options = new Map<string, { id: string; name: string }[]>();
  for (const p of (pool ?? []) as unknown as { person_id: string; position: string; people: { first_name: string; last_name: string } | null }[]) {
    if (!p.people) continue;
    options.set(p.position, [...(options.get(p.position) ?? []), { id: p.person_id, name: personName(p.people) }]);
  }
  for (const list of options.values()) list.sort((a, b) => a.name.localeCompare(b.name, "fr"));

  // Contrôles : postes vides, deux postes le même jour, indisponibilité.
  const sameDay = new Map<string, number>();
  for (const s of services)
    for (const p of s.positions) if (p.personId) sameDay.set(`${s.service_date}|${p.personId}`, (sameDay.get(`${s.service_date}|${p.personId}`) ?? 0) + 1);
  const warningFor = (date: string, personId: string | null) => {
    if (!personId) return null;
    if ((sameDay.get(`${date}|${personId}`) ?? 0) > 1) return "Deux postes le même jour";
    if ([...(unavailable ?? []), ...(absences ?? [])].some((u) => u.person_id === personId && u.starts_on <= date && date <= u.ends_on)) return "Indisponible ce jour-là";
    return null;
  };
  const empty = services.flatMap((s) => s.positions.filter((p) => programPositions.includes(p.position) && !p.personId));
  const conflicts = services.flatMap((s) => s.positions.filter((p) => warningFor(s.service_date, p.personId)));
  const drafts = services.filter((s) => !s.published).length;
  const emptyPools = programPositions.filter((p) => !options.get(p)?.length);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pb-8 pt-5">
      <PageTitle title="Préparer le programme" intro="Générer, ajuster, puis publier : les fidèles ne voient que le programme publié." />

      <Card className="flex flex-col gap-3 shadow-card">
        <h2 className="text-lg font-semibold">1. Générer</h2>
        {emptyPools.length > 0 && (
          <p className="flex items-start gap-2 rounded-2xl bg-warn-bg px-3 py-2 text-sm font-medium text-warn-text">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            Vivier vide : {emptyPools.join(", ")}. Ajoutez des personnes dans « Viviers » avant de générer.
          </p>
        )}
        <ActionForm action={generateProgram} submitLabel="Générer le programme" variant="primary">
          <div className="grid grid-cols-2 gap-3">
            <TextField label="À partir du" name="from" type="date" defaultValue={from} required />
            <SelectField
              label="Durée"
              name="months"
              defaultValue={String(months)}
              options={periods.map((m) => ({ value: String(m), label: `${m} mois` }))}
            />
          </div>
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <input type="checkbox" name="redo" className="mt-1 size-5 accent-royal" />
            <span>Refaire les attributions automatiques non publiées (vos choix à la main sont gardés).</span>
          </label>
        </ActionForm>
      </Card>

      <section className="flex flex-col gap-3" aria-labelledby="verif">
        <h2 id="verif" className="text-lg font-semibold">
          2. Vérifier : du {formatFullDate(from)} au {formatFullDate(to)}
        </h2>
        <form className="flex items-end gap-2" action="/cultes/programme">
          <TextField label="Afficher à partir du" name="du" type="date" defaultValue={from} className="flex-1" />
          <input type="hidden" name="mois" value={months} />
          <button type="submit" className="min-h-13 rounded-2xl bg-royal/10 px-4 font-semibold text-royal">
            Voir
          </button>
        </form>
        <ul className="flex flex-wrap gap-2 text-sm font-semibold">
          <li className="rounded-full bg-surface px-3 py-1 shadow-card">{services.length} cultes</li>
          <li className={`rounded-full px-3 py-1 ${empty.length ? "bg-alert-bg text-alert-text" : "bg-ok-bg text-ok-text"}`}>
            {empty.length} poste{empty.length > 1 ? "s" : ""} vide{empty.length > 1 ? "s" : ""}
          </li>
          <li className={`rounded-full px-3 py-1 ${conflicts.length ? "bg-warn-bg text-warn-text" : "bg-ok-bg text-ok-text"}`}>
            {conflicts.length} conflit{conflicts.length > 1 ? "s" : ""}
          </li>
          <li className="rounded-full bg-warm/20 px-3 py-1 text-night">{drafts} en brouillon</li>
        </ul>
        {services.length === 0 && <p className="rounded-card bg-surface p-4 text-muted">Aucun culte sur cette période : générez le programme.</p>}
        {services.map((s) => (
          <ServiceCard
            key={s.service_id}
            service={s}
            renderPosition={(p) =>
              programPositions.includes(p.position) || p.personId ? (
                <PositionSelect
                  action={setPositionPerson}
                  positionId={p.id}
                  label={p.position}
                  value={p.personId}
                  options={[
                    ...(options.get(p.position) ?? []),
                    ...(p.personId && !(options.get(p.position) ?? []).some((o) => o.id === p.personId) && p.personName
                      ? [{ id: p.personId, name: p.personName }]
                      : []),
                  ]}
                  warning={warningFor(s.service_date, p.personId)}
                />
              ) : (
                <span className="flex justify-between text-sm">
                  <span className="text-muted">{p.position}</span>
                  <span className="text-muted">tenu par l&apos;équipe</span>
                </span>
              )
            }
          >
            {!s.published && (
              <form action={deleteDraftService} className="self-end">
                <input type="hidden" name="service_id" value={s.service_id} />
                <SubmitButton className="flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-alert-text hover:bg-alert-bg">
                  <Trash2 aria-hidden className="size-4" /> Retirer ce culte
                </SubmitButton>
              </form>
            )}
          </ServiceCard>
        ))}
      </section>

      <Card className="flex flex-col gap-3 shadow-card">
        <h2 className="text-lg font-semibold">3. Publier</h2>
        <p className="text-sm text-muted">
          Les fidèles verront le programme et chaque personne programmée recevra une notification, puis un rappel 3 jours et 1 jour avant.
        </p>
        <ActionForm action={publishProgram} hidden={{ from, to }} submitLabel={`Publier du ${formatShortDay(from)} au ${formatShortDay(to)}`} variant="gold" />
      </Card>

      <section className="flex flex-col gap-3" aria-labelledby="echanges">
        <h2 id="echanges" className="flex items-center gap-2 text-lg font-semibold">
          <Repeat2 aria-hidden className="size-5 text-royal" /> Demandes d&apos;échange
        </h2>
        {(swaps ?? []).length === 0 && <p className="rounded-card bg-surface p-4 text-sm text-muted">Aucune demande en attente.</p>}
        {((swaps ?? []) as unknown as Swap[]).map((r) => (
          <Card key={r.id} className="flex flex-col gap-2 shadow-card">
            <p>
              <span className="font-semibold">{r.requester ? personName(r.requester) : "?"}</span> propose{" "}
              <span className="font-semibold">{r.replacement ? personName(r.replacement) : "?"}</span> pour{" "}
              {r.service_positions?.position.toLowerCase()} · {r.service_positions?.services?.title} du{" "}
              {r.service_positions?.services ? formatShortDay(r.service_positions.services.service_date) : ""}
            </p>
            {r.reason && <p className="text-sm text-muted">« {r.reason} »</p>}
            <div className="flex gap-2">
              {[
                ["1", "Accepter", "bg-ok-ring text-white"],
                ["0", "Refuser", "bg-alert-bg text-alert-text"],
              ].map(([approve, label, cls]) => (
                <form key={approve} action={decideSwap}>
                  <input type="hidden" name="request_id" value={r.id} />
                  <input type="hidden" name="approve" value={approve} />
                  <SubmitButton className={`min-h-11 rounded-full px-4 text-sm font-semibold ${cls}`}>{label}</SubmitButton>
                </form>
              ))}
            </div>
          </Card>
        ))}
      </section>

      <Card className="flex flex-col gap-3 shadow-card">
        <h2 className="text-lg font-semibold">Programme exceptionnel</h2>
        <p className="text-sm text-muted">Veillée, croisade, convention, jeûne, action de grâce…</p>
        <ActionForm action={createExceptionalService} submitLabel="Ajouter au programme">
          <TextField label="Nom" name="title" placeholder="Veillée de prière" required />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Date" name="date" type="date" defaultValue={addDays(today, 7)} required />
            <TextField label="Lieu (facultatif)" name="place" />
            <TextField label="Début" name="start" type="time" defaultValue="21:00" required />
            <TextField label="Fin (facultatif)" name="end" type="time" />
          </div>
          <SelectField label="Mêmes postes que" name="type_id" options={(types ?? []).map((t) => ({ value: t.id, label: t.name }))} />
        </ActionForm>
      </Card>
    </div>
  );
}
