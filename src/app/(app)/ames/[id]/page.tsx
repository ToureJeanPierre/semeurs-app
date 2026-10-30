import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle, CircleCheck, IdCard, MapPin, Trash2, X } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { PersonPicker } from "@/components/admin/PersonPicker";
import { ContactButtons } from "@/components/alerts/ContactButtons";
import { PersonFollowUp } from "@/components/alerts/PersonFollowUp";
import { PersonHome } from "@/components/location/PersonHome";
import { ActionForm } from "@/components/people/ActionForm";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { getAccess, hasAny } from "@/lib/access";
import { loadPeopleOptions } from "@/lib/admin";
import { fillTemplate } from "@/lib/contact-links";
import { formatFullDate, formatShortDay, todayIso } from "@/lib/format";
import { loadHomeData } from "@/lib/home";
import { loadMessageTemplate } from "@/lib/message-templates";
import { INVITE_FALLBACK, inviteMessage, nextServicePhrase } from "@/lib/outreach";
import { loadValueList } from "@/lib/people";
import { isStepDone, nextStep, type Soul, type Step } from "@/lib/souls";
import { createClient } from "@/lib/supabase/server";
import { assignSoul, endAssignment, toggleStep } from "../actions";
import { archivePerson } from "../../fideles/actions";
import { ReasonPicker } from "@/components/ui/ReasonPicker";

export const metadata: Metadata = { title: "Accompagnement" };

/** Une âme : parcours d'intégration à cocher, bienvenue WhatsApp, personnes qui suivent, journal partagé. */
export default async function SoulPage({ params, searchParams }: PageProps<"/ames/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const access = await getAccess();
  const manager = hasAny(access, ["souls.manage"]);
  const [{ data: souls }, { data: steps }, { data: done }, { data: canManage }, statuses, welcome, { data: assignments }, people, invite, home, { data: place }] = await Promise.all([
    supabase.rpc("souls_overview"),
    supabase.from("integration_steps").select("id, code, label, position, due_days").eq("active", true).order("position"),
    supabase.from("person_steps").select("step_id, done_on").eq("person_id", id),
    supabase.rpc("can_manage_person", { target: id }),
    loadValueList("person_status"),
    loadMessageTemplate("welcome", "Bonjour {prénom}, merci d'être venu(e) aux Semeurs de la Parole. Jésus-Christ t'aime."),
    supabase.from("soul_assignments").select("id, assignee_id").eq("person_id", id).is("end_date", null),
    manager ? loadPeopleOptions() : Promise.resolve([]),
    loadMessageTemplate("outreach_invite", INVITE_FALLBACK),
    loadHomeData(),
    supabase.from("people").select("district, commune, landmark").eq("id", id).maybeSingle(),
  ]);
  const soul = ((souls ?? []) as Soul[]).find((s) => s.id === id);
  if (!soul) notFound();
  const stepList = (steps ?? []) as Step[];
  const doneOn = new Map(((done ?? []) as { step_id: string; done_on: string }[]).map((d) => [d.step_id, d.done_on]));
  const next = nextStep(soul, stepList, todayIso());
  const name = `${soul.last_name.toUpperCase()} ${soul.first_name}`;
  const archiveReasons = manager || hasAny(access, ["people.manage"]) ? await loadValueList("archive_reason") : [];
  // Ceux qui accompagnent cette âme (gagneur, membre à qui elle est confiée, responsable) peuvent la visiter.
  const follows =
    manager || soul.brought_by === access.personId || ((assignments ?? []) as { assignee_id: string }[]).some((a) => a.assignee_id === access.personId);
  const culte = nextServicePhrase(home.services, new Date());
  const where = [place?.district, place?.commune].filter(Boolean).join(", ");

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      {query.nouvelle === "1" && (
        <p role="status" className="flex items-start gap-2 rounded-2xl bg-ok-bg px-4 py-3 font-medium text-ok-text">
          <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0" />
          Fiche enregistrée. Envoyez maintenant le message de bienvenue.
        </p>
      )}
      <PageTitle
        title={name}
        intro={`${statuses.find((s) => s.value === soul.status)?.label ?? soul.status}${soul.arrived_at ? ` · arrivé(e) le ${formatFullDate(soul.arrived_at)}` : ""}${soul.brought_by_name ? ` · amené(e) par ${soul.brought_by_name}` : ""}`}
      />

      {soul.phone ? (
        <Card className="flex flex-col gap-3 shadow-card">
          <h2 className="font-semibold">Contacter {soul.first_name}</h2>
          <ContactButtons large name={name} phone={soul.phone} />
          <details className="rounded-xl bg-cloud px-3">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-royal">Message de bienvenue (déjà écrit)</summary>
            <div className="flex flex-col gap-2 pb-3">
              <p className="rounded-2xl bg-[#e7f6ec] p-3 text-sm">{fillTemplate(welcome, soul.first_name)}</p>
              <ContactButtons name={name} phone={soul.phone} message={fillTemplate(welcome, soul.first_name)} />
            </div>
          </details>
          {culte && (
            <details className="rounded-xl bg-cloud px-3">
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-royal">Inviter au prochain culte (déjà écrit)</summary>
              <div className="flex flex-col gap-2 pb-3">
                <p className="rounded-2xl bg-[#e7f6ec] p-3 text-sm">{inviteMessage(invite, soul.first_name, culte.phrase)}</p>
                <ContactButtons name={name} phone={soul.phone} message={inviteMessage(invite, soul.first_name, culte.phrase)} />
              </div>
            </details>
          )}
        </Card>
      ) : (
        <Link href={`/fideles/${id}`} className="rounded-2xl border-2 border-dashed border-warn-ring bg-warn-bg px-4 py-3 text-sm font-semibold text-warn-text">
          Pas de numéro de téléphone : touchez ici pour l&apos;ajouter sur sa fiche (« Modifier la fiche »).
        </Link>
      )}

      {follows && (
        <section className="flex flex-col gap-2">
          <Card className="flex flex-col gap-2 shadow-card">
            <h2 className="font-semibold">Lui rendre visite</h2>
            <p className="flex items-start gap-2 text-sm">
              <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-alert-ring" />
              <span>
                {where || "Quartier non renseigné"}
                {place?.landmark ? ` · repère : ${place.landmark}` : ""}
              </span>
            </p>
            {where && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${where}, Abidjan`)}`}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-11 items-center justify-center rounded-full bg-royal/10 text-sm font-semibold text-royal"
              >
                Voir le quartier sur la carte
              </a>
            )}
          </Card>
          <PersonHome personId={id} firstName={soul.first_name} phone={soul.phone} canManage />
        </section>
      )}

      <Card className="flex flex-col gap-1 shadow-card">
        <h2 className="font-semibold">Parcours d&apos;intégration</h2>
        <ul className="flex flex-col">
          {stepList.map((st) => {
            const isDone = isStepDone(soul, st.code);
            const automatic = (st.code === "family" && soul.in_family) || (st.code === "team" && soul.in_team);
            return (
              <li key={st.id}>
                <form action={toggleStep} className="flex items-center gap-2">
                  <input type="hidden" name="person_id" value={id} />
                  <input type="hidden" name="step_id" value={st.id} />
                  <input type="hidden" name="done" value={isDone ? "0" : "1"} />
                  <SubmitButton
                    disabled={automatic}
                    aria-label={isDone ? `Décocher : ${st.label}` : `Cocher : ${st.label}`}
                    className="flex min-h-12 w-full items-center gap-3 rounded-xl px-1 text-left hover:bg-cloud"
                  >
                    {isDone ? <CheckCircle2 aria-hidden className="size-6 shrink-0 text-ok-ring" /> : <Circle aria-hidden className="size-6 shrink-0 text-muted" />}
                    <span className="flex-1">
                      <span className={`block ${isDone ? "text-muted" : "font-semibold"} ${next?.step.id === st.id && next.late ? "text-alert-text" : ""}`}>{st.label}</span>
                      {doneOn.get(st.id) && <span className="block text-xs text-muted">Fait le {formatShortDay(doneOn.get(st.id)!)}</span>}
                      {automatic && <span className="block text-xs text-muted">Constaté automatiquement</span>}
                      {next?.step.id === st.id && next.late && <span className="block text-xs font-semibold text-alert-text">En retard</span>}
                    </span>
                  </SubmitButton>
                </form>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="flex flex-col gap-2 shadow-card">
        <h2 className="font-semibold">Qui accompagne</h2>
        <ul className="text-sm">
          {soul.brought_by_name && <li>Gagneur d&apos;âme : <span className="font-semibold">{soul.brought_by_name}</span></li>}
          {soul.assignees.map((a) => (
            <li key={a}>Membre évangélisation : <span className="font-semibold">{a}</span></li>
          ))}
          {!soul.brought_by_name && soul.assignees.length === 0 && <li className="text-muted">Personne pour l&apos;instant.</li>}
        </ul>
        {manager && (
          <>
            {((assignments ?? []) as { id: string; assignee_id: string }[]).map((a) => (
              <form key={a.id} action={endAssignment} className="flex items-center gap-2 text-sm">
                <input type="hidden" name="assignment_id" value={a.id} />
                <span className="flex-1">{people.find((p) => p.id === a.assignee_id)?.name}</span>
                <SubmitButton className="flex min-h-11 items-center gap-1 rounded-full px-3 font-semibold text-alert-text hover:bg-alert-bg">
                  <X aria-hidden className="size-4" /> Retirer
                </SubmitButton>
              </form>
            ))}
            <ActionForm action={assignSoul} hidden={{ person_id: id }} submitLabel="Confier cette âme">
              <PersonPicker name="assignee_id" label="Confier à un membre de l'évangélisation" people={people} />
            </ActionForm>
          </>
        )}
      </Card>

      <Link href={`/fideles/${id}`} className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-royal/10 font-semibold text-royal">
        <IdCard aria-hidden className="size-5" /> Voir la fiche complète
      </Link>

      <PersonFollowUp personId={id} name={soul.first_name} canManage={Boolean(canManage)} />

      {(manager || hasAny(access, ["people.manage"])) && (
        <details className="rounded-card bg-surface px-4 shadow-card">
          <summary className="flex min-h-12 cursor-pointer items-center gap-2 font-semibold text-alert-text">
            <Trash2 aria-hidden className="size-5" /> Supprimer cette âme
          </summary>
          <ActionForm action={archivePerson} hidden={{ person_id: id, from: "ames" }} submitLabel="Supprimer de la liste" className="flex flex-col gap-3 pb-4">
            <p className="text-sm text-muted">
              {soul.first_name} disparaîtra de la liste des âmes et des fidèles. Rien n&apos;est effacé : la fiche peut être restaurée sur demande.
            </p>
            <ReasonPicker label="Motif" options={archiveReasons} />
          </ActionForm>
        </details>
      )}
    </div>
  );
}
