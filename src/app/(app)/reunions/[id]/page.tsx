import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarClock, CheckCircle2, Circle, MapPin, Video } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { MODE_LABEL, RESPONSE_LABEL, STATUS_LABEL } from "@/components/meetings/meeting-labels";
import { ActionForm } from "@/components/people/ActionForm";
import { Card } from "@/components/ui/Card";
import { SelectField, TextAreaField } from "@/components/ui/SelectField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { getAccess, hasAny } from "@/lib/access";
import { formatHour, formatLongDay, formatShortDay } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { addTask, cancelMeeting, respondMeeting, saveMinutes, toggleTask } from "../actions";

export const metadata: Metadata = { title: "Réunion" };

type Meeting = {
  id: string;
  title: string;
  agenda: string | null;
  starts_at: string;
  ends_at: string | null;
  mode: string;
  place: string | null;
  online_url: string | null;
  organizer_id: string;
  status: string;
  minutes: string | null;
  decisions: string | null;
};
type Invitee = { person_id: string; name: string; response: string; attended: boolean | null };
type Task = { id: string; title: string; assignee_id: string | null; due_on: string | null; done_at: string | null };

export default async function MeetingPage({ params }: PageProps<"/reunions/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("meetings").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const m = data as Meeting;
  const access = await getAccess();
  const [{ data: invitees }, { data: tasks }] = await Promise.all([
    supabase.rpc("meeting_people", { p_meeting: id }),
    supabase.from("meeting_tasks").select("id, title, assignee_id, due_on, done_at").eq("meeting_id", id).order("created_at"),
  ]);
  const people = (invitees ?? []) as Invitee[];
  const organizer = m.organizer_id === access.personId || hasAny(access, ["meetings.manage"]);
  const me = people.find((p) => p.person_id === access.personId);
  const nameOf = (pid: string | null) => people.find((p) => p.person_id === pid)?.name ?? "";
  const counts = { yes: 0, maybe: 0, no: 0, pending: 0 } as Record<string, number>;
  for (const p of people) counts[p.response]++;
  const planned = m.status === "planned";

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title={m.title} intro={`${STATUS_LABEL[m.status]} · organisée par ${nameOf(m.organizer_id) || "…"}`} />

      <Card className="flex flex-col gap-2 shadow-card">
        <p className="flex items-center gap-2 font-semibold first-letter:uppercase">
          <CalendarClock aria-hidden className="size-5 text-royal" />
          {formatLongDay(m.starts_at)} · {formatHour(m.starts_at)}
          {m.ends_at ? ` – ${formatHour(m.ends_at)}` : ""}
        </p>
        <p className="flex items-center gap-2 text-muted">
          {m.mode === "online" ? <Video aria-hidden className="size-5" /> : <MapPin aria-hidden className="size-5" />}
          {MODE_LABEL[m.mode]}
          {m.place ? ` · ${m.place}` : ""}
        </p>
        {m.online_url && planned && (
          <a
            href={m.online_url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 flex min-h-13 items-center justify-center gap-2 rounded-full bg-[#1f8f4e] font-semibold text-white"
          >
            <Video aria-hidden className="size-5" /> Rejoindre la salle en ligne
          </a>
        )}
        {m.online_url && planned && (
          <p className="text-xs text-muted">Gratuit, sans compte. Sur téléphone, autorisez la caméra et le micro (ou installez l&apos;appli Jitsi Meet).</p>
        )}
        {m.agenda && (
          <div className="mt-2 rounded-2xl bg-cloud p-3">
            <h2 className="text-sm font-semibold text-royal">Ordre du jour</h2>
            <p className="whitespace-pre-wrap text-sm">{m.agenda}</p>
          </div>
        )}
      </Card>

      {me && planned && m.organizer_id !== access.personId && (
        <Card className="flex flex-col gap-2 shadow-card">
          <h2 className="font-semibold">Serez-vous là ? <span className="text-sm font-normal text-muted">({RESPONSE_LABEL[me.response]})</span></h2>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["yes", "Oui", "bg-ok-ring text-white"],
              ["maybe", "Peut-être", "bg-warn-bg text-warn-text"],
              ["no", "Non", "bg-alert-bg text-alert-text"],
            ].map(([value, label, cls]) => (
              <form key={value} action={respondMeeting}>
                <input type="hidden" name="meeting_id" value={id} />
                <input type="hidden" name="response" value={value} />
                <SubmitButton className={`min-h-12 w-full rounded-full font-semibold ${cls} ${me.response === value ? "ring-4 ring-royal/30" : ""}`}>
                  {label}
                </SubmitButton>
              </form>
            ))}
          </div>
        </Card>
      )}

      {(m.minutes || m.decisions) && (
        <Card className="flex flex-col gap-2 shadow-card">
          <h2 className="font-semibold">Compte rendu</h2>
          {m.minutes && <p className="whitespace-pre-wrap text-sm">{m.minutes}</p>}
          {m.decisions && (
            <>
              <h3 className="text-sm font-semibold text-royal">Décisions</h3>
              <p className="whitespace-pre-wrap text-sm">{m.decisions}</p>
            </>
          )}
        </Card>
      )}

      <Card className="flex flex-col gap-2 shadow-card">
        <h2 className="font-semibold">
          Invités ({people.length}) <span className="text-sm font-normal text-muted">· {counts.yes} oui · {counts.maybe} peut-être · {counts.no} non · {counts.pending} sans réponse</span>
        </h2>
        <ul className="flex flex-col divide-y divide-line">
          {people.map((p) => (
            <li key={p.person_id} className="flex min-h-11 items-center justify-between gap-2 py-1">
              <span className="font-semibold">{p.name}</span>
              <span className="text-sm text-muted">
                {p.attended === true ? "Était là" : p.attended === false ? "Absent(e)" : RESPONSE_LABEL[p.response]}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="flex flex-col gap-2 shadow-card">
        <h2 className="font-semibold">Tâches</h2>
        {(tasks ?? []).length === 0 && <p className="text-sm text-muted">Aucune tâche pour l&apos;instant.</p>}
        <ul className="flex flex-col divide-y divide-line">
          {((tasks ?? []) as Task[]).map((t) => {
            const mineOrOrg = organizer || t.assignee_id === access.personId;
            return (
              <li key={t.id} className="flex items-center gap-2 py-1">
                <form action={toggleTask}>
                  <input type="hidden" name="task_id" value={t.id} />
                  <input type="hidden" name="done" value={t.done_at ? "0" : "1"} />
                  <SubmitButton
                    disabled={!mineOrOrg}
                    aria-label={t.done_at ? "Marquer à faire" : "Marquer faite"}
                    className="grid size-11 place-items-center rounded-full text-royal"
                  >
                    {t.done_at ? <CheckCircle2 aria-hidden className="size-6 text-ok-ring" /> : <Circle aria-hidden className="size-6" />}
                  </SubmitButton>
                </form>
                <span className="min-w-0 flex-1">
                  <span className={`block font-semibold ${t.done_at ? "text-muted line-through" : ""}`}>{t.title}</span>
                  <span className="block text-sm text-muted">
                    {nameOf(t.assignee_id) || "Personne désignée"}
                    {t.due_on ? ` · avant le ${formatShortDay(t.due_on)}` : ""}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        {organizer && m.status !== "cancelled" && (
          <details className="rounded-xl bg-cloud px-3">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-royal">Ajouter une tâche</summary>
            <ActionForm action={addTask} hidden={{ meeting_id: id }} submitLabel="Ajouter la tâche" className="flex flex-col gap-3 pb-3">
              <TextField label="Tâche" name="title" placeholder="Visiter la famille Brou" required />
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Confiée à" name="assignee_id" options={[{ value: "", label: "Choisir…" }, ...people.map((p) => ({ value: p.person_id, label: p.name }))]} />
                <TextField label="Avant le" name="due_on" type="date" />
              </div>
            </ActionForm>
          </details>
        )}
      </Card>

      {organizer && m.status !== "cancelled" && (
        <Card className="flex flex-col gap-3 shadow-card">
          <h2 className="font-semibold">Après la réunion</h2>
          <ActionForm action={saveMinutes} hidden={{ meeting_id: id }} submitLabel="Enregistrer le compte rendu" variant="primary">
            <fieldset className="flex flex-col">
              <legend className="mb-1 text-sm font-semibold">Qui était là ?</legend>
              {people.map((p) => (
                <label key={p.person_id} className="flex min-h-11 items-center gap-3">
                  <input type="hidden" name="invitee" value={p.person_id} />
                  <input type="checkbox" name="present" value={p.person_id} defaultChecked={p.attended ?? p.response === "yes"} className="size-5 accent-royal" />
                  {p.name}
                </label>
              ))}
            </fieldset>
            <TextAreaField label="Compte rendu" name="minutes" rows={5} defaultValue={m.minutes ?? ""} />
            <TextAreaField label="Décisions" name="decisions" rows={3} defaultValue={m.decisions ?? ""} />
          </ActionForm>
          {planned && (
            <details className="rounded-xl bg-cloud px-3">
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-alert-text">Annuler la réunion</summary>
              <ActionForm action={cancelMeeting} hidden={{ meeting_id: id }} submitLabel="Annuler et prévenir les invités" variant="ghost" className="flex flex-col gap-3 pb-3" />
            </details>
          )}
        </Card>
      )}
    </div>
  );
}
