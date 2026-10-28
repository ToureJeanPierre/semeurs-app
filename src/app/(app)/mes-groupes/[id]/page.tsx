import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, CheckSquare, ClipboardList, Megaphone, MapPin, Music, Trash2, Wallet } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { PersonPicker } from "@/components/admin/PersonPicker";
import { DutiesSection } from "@/components/groups/DutiesSection";
import { ActionForm } from "@/components/people/ActionForm";
import { Card } from "@/components/ui/Card";
import { ModuleIcon } from "@/components/ui/icons";
import { SelectField, TextAreaField } from "@/components/ui/SelectField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { getAccess, hasAny } from "@/lib/access";
import { addDays, formatHour, formatLongDay, formatShortDay, todayIso } from "@/lib/format";
import { expandEvents, WEEKDAYS, type GroupEvent } from "@/lib/group-agenda";
import { loadValueList } from "@/lib/people";
import { createClient } from "@/lib/supabase/server";
import { addGroupEvent, addResource, deleteGroupEvent, deleteResource, openGroupSession, saveMeetingInfo, submitReport } from "../actions";

export const metadata: Metadata = { title: "Mon groupe" };

type Group = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  settings: { meeting?: { weekday: number | null; time: string | null; place: string | null; landmark: string | null; host_id: string | null } } | null;
  group_types: { name: string; icon: string; color: string; slug: string } | null;
};
type Member = { person_id: string; name: string; function_label: string | null };

/**
 * Tableau de bord d'un groupe : chaque capacité cochée par l'administrateur apparaît ici
 * d'elle-même, pour n'importe quel groupe (docs/01 §4 : tout se configure).
 */
export default async function GroupHubPage({ params }: PageProps<"/mes-groupes/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const access = await getAccess();
  const [{ data: g }, { data: caps }, { data: available }, { data: myGroups }, { data: leads }, { data: records }, { data: senders }, { data: people }] =
    await Promise.all([
      supabase.from("groups").select("id, name, description, color, settings, group_types(name, icon, color, slug)").eq("id", id).maybeSingle(),
      supabase.from("group_capabilities").select("capability_code, settings").eq("group_id", id),
      supabase.from("capabilities").select("code").eq("available", true),
      supabase.rpc("my_groups"),
      supabase.rpc("my_groups_with", { p_permission: "groups.manage" }),
      supabase.rpc("my_groups_with", { p_permission: "attendance.record" }),
      supabase.rpc("my_groups_with", { p_permission: "messages.send" }),
      supabase.rpc("group_people", { p_group: id }),
    ]);
  if (!g) notFound();
  const group = g as unknown as Group;
  const mine = ((myGroups ?? []) as { id: string; my_function: string | null }[]).find((x) => x.id === id);
  const leader = ((leads ?? []) as { id: string }[]).some((x) => x.id === id);
  if (!mine && !leader && !hasAny(access, ["people.view"])) notFound();
  const canRecord = ((records ?? []) as { id: string }[]).some((x) => x.id === id);
  const canSend = ((senders ?? []) as { id: string }[]).some((x) => x.id === id);
  const ready = new Set(((available ?? []) as { code: string }[]).map((c) => c.code));
  const capSettings = new Map(((caps ?? []) as { capability_code: string; settings: unknown }[]).filter((c) => ready.has(c.capability_code)).map((c) => [c.capability_code, c.settings]));
  const has = (code: string) => capSettings.has(code);
  const members = (people ?? []) as Member[];
  const memberOptions = members.map((m) => ({ id: m.person_id, name: m.name }));
  const meeting = group.settings?.meeting;
  const host = members.find((m) => m.person_id === meeting?.host_id);
  const today = todayIso();

  const [{ data: events }, { data: sessions }, { data: resources }, { data: reports }, kinds] = await Promise.all([
    has("agenda") ? supabase.from("group_events").select("*").eq("group_id", id) : Promise.resolve({ data: [] }),
    has("attendance") && canRecord
      ? supabase.from("sessions").select("id, title, session_date, attendance(count)").eq("group_id", id).order("session_date", { ascending: false }).limit(6)
      : Promise.resolve({ data: [] }),
    has("resources") ? supabase.from("group_resources").select("id, title, kind, music_key, body, url").eq("group_id", id).order("title") : Promise.resolve({ data: [] }),
    has("activity_reports") && leader
      ? supabase.from("group_reports").select("id, meeting_date, present_count, newcomers_count, theme, needs").eq("group_id", id).order("meeting_date", { ascending: false }).limit(5)
      : Promise.resolve({ data: [] }),
    loadValueList("resource_kind"),
  ]);
  const occurrences = expandEvents((events ?? []) as GroupEvent[], today, addDays(today, 42));
  const lastReport = ((reports ?? []) as { meeting_date: string }[])[0]?.meeting_date;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <div className="flex items-center gap-3">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl text-white" style={{ background: group.color ?? group.group_types?.color ?? "var(--color-royal)" }}>
          <ModuleIcon name={group.group_types?.icon ?? "users-round"} className="size-7" strokeWidth={1.9} />
        </span>
        <div className="min-w-0">
          <PageTitle title={group.name} intro={`${group.group_types?.name ?? ""}${mine?.my_function ? ` · ${mine.my_function}` : ""} · ${members.length || "?"} membre${members.length > 1 ? "s" : ""}`} />
        </div>
      </div>
      {group.description && <p className="-mt-3">{group.description}</p>}

      {/* Rencontre habituelle */}
      {(meeting?.place || meeting?.weekday != null || leader) && (
        <Card className="flex flex-col gap-2 shadow-card">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MapPin aria-hidden className="size-5 text-royal" /> Rencontre
          </h2>
          {meeting?.weekday != null || meeting?.place ? (
            <p>
              {meeting?.weekday != null && (
                <span className="block font-semibold">
                  Chaque {WEEKDAYS[meeting.weekday]}
                  {meeting.time ? ` à ${formatHour(`2000-01-01T${meeting.time}:00Z`)}` : ""}
                </span>
              )}
              {meeting?.place && <span className="block text-sm text-muted">{meeting.place}{meeting.landmark ? ` · ${meeting.landmark}` : ""}</span>}
              {host && <span className="block text-sm text-muted">Chez {host.name}</span>}
            </p>
          ) : (
            <p className="text-sm text-muted">Lieu et horaire pas encore indiqués.</p>
          )}
          {leader && (
            <details className="rounded-xl bg-cloud px-3">
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-royal">Modifier le lieu et l&apos;horaire</summary>
              <ActionForm action={saveMeetingInfo} hidden={{ group_id: id }} submitLabel="Enregistrer" className="flex flex-col gap-3 pb-3">
                <div className="grid grid-cols-2 gap-3">
                  <SelectField label="Jour" name="weekday" defaultValue={meeting?.weekday != null ? String(meeting.weekday) : ""} options={[{ value: "", label: "—" }, ...WEEKDAYS.map((d, i) => ({ value: String(i), label: d }))]} />
                  <TextField label="Heure" name="time" type="time" defaultValue={meeting?.time ?? ""} />
                </div>
                <TextField label="Lieu" name="place" defaultValue={meeting?.place ?? ""} placeholder="Camp Militaire, carrefour Niangon" />
                <TextField label="Repère" name="landmark" defaultValue={meeting?.landmark ?? ""} placeholder="Derrière la pharmacie" />
                <PersonPicker name="host_id" label="Hôte (facultatif)" people={memberOptions} defaultId={meeting?.host_id} />
              </ActionForm>
            </details>
          )}
        </Card>
      )}

      {members.length > 0 && (
        <Card className="flex flex-col gap-1 shadow-card">
          <h2 className="text-lg font-semibold">Membres</h2>
          <ul className="flex flex-col divide-y divide-line text-sm">
            {members.map((m) => (
              <li key={m.person_id} className="flex min-h-10 items-center justify-between gap-2">
                <span className="font-semibold">{m.name}</span>
                {m.function_label && <span className="text-muted">{m.function_label}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {has("agenda") && (
        <Card className="flex flex-col gap-2 shadow-card">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <CalendarDays aria-hidden className="size-5 text-royal" /> Agenda
          </h2>
          {occurrences.length === 0 && <p className="text-sm text-muted">Rien de prévu ces six prochaines semaines.</p>}
          <ul className="flex flex-col divide-y divide-line">
            {occurrences.slice(0, 10).map((o) => (
              <li key={`${o.id}-${o.date}`} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{o.title}</span>
                  <span className="block text-sm text-muted first-letter:uppercase">
                    {formatLongDay(o.date)} · {formatHour(o.startsAt)}
                    {o.place ? ` · ${o.place}` : ""}
                    {o.recurrence === "weekly" ? " · chaque semaine" : ""}
                  </span>
                </span>
                {leader && (
                  <form action={deleteGroupEvent}>
                    <input type="hidden" name="event_id" value={o.id} />
                    <SubmitButton aria-label={`Retirer ${o.title}`} className="grid size-11 place-items-center rounded-full text-alert-text hover:bg-alert-bg">
                      <Trash2 aria-hidden className="size-4" />
                    </SubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
          {leader && (
            <details className="rounded-xl bg-cloud px-3">
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-royal">Ajouter une activité</summary>
              <ActionForm action={addGroupEvent} hidden={{ group_id: id }} submitLabel="Ajouter à l'agenda" className="flex flex-col gap-3 pb-3">
                <TextField label="Activité" name="title" placeholder="Répétition" required />
                <div className="grid grid-cols-3 gap-3">
                  <TextField label="Date" name="date" type="date" defaultValue={today} className="col-span-3" />
                  <TextField label="Début" name="start" type="time" defaultValue="18:00" />
                  <TextField label="Fin" name="end" type="time" />
                  <SelectField label="Répéter" name="recurrence" options={[{ value: "none", label: "Non" }, { value: "weekly", label: "Chaque semaine" }]} />
                </div>
                <TextField label="Lieu" name="place" />
              </ActionForm>
            </details>
          )}
        </Card>
      )}

      {has("attendance") && canRecord && (
        <Card className="flex flex-col gap-2 shadow-card">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <CheckSquare aria-hidden className="size-5 text-royal" /> Présences
          </h2>
          <ActionForm action={openGroupSession} hidden={{ group_id: id }} submitLabel="Pointer cette rencontre" variant="primary">
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Date" name="date" type="date" defaultValue={today} />
              <TextField label="Rencontre" name="title" defaultValue={has("activity_reports") ? "Réunion de cellule" : "Rencontre"} />
            </div>
          </ActionForm>
          {((sessions ?? []) as { id: string; title: string; session_date: string; attendance: { count: number }[] }[]).map((s) => (
            <Link key={s.id} href={`/mes-groupes/${id}/pointage/${s.id}`} className="flex min-h-12 items-center justify-between gap-2 border-t border-line text-sm">
              <span>
                <span className="font-semibold">{s.title}</span> · {formatShortDay(s.session_date)}
              </span>
              <span className="text-muted">
                {s.attendance[0]?.count ?? 0} / {members.length} présent{(s.attendance[0]?.count ?? 0) > 1 ? "s" : ""}
              </span>
            </Link>
          ))}
        </Card>
      )}

      {has("service_planning") && (
        <DutiesSection groupId={id} capability="service_planning" settings={capSettings.get("service_planning") as never} leader={leader} members={memberOptions} me={access.personId} />
      )}
      {has("prayer_chain") && (
        <DutiesSection groupId={id} capability="prayer_chain" settings={capSettings.get("prayer_chain") as never} leader={leader} members={memberOptions} me={access.personId} />
      )}

      {has("resources") && (
        <Card className="flex flex-col gap-2 shadow-card">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Music aria-hidden className="size-5 text-royal" /> Répertoire
          </h2>
          {(resources ?? []).length === 0 && <p className="text-sm text-muted">Le répertoire est vide.</p>}
          {((resources ?? []) as { id: string; title: string; kind: string; music_key: string | null; body: string | null; url: string | null }[]).map((r) => (
            <details key={r.id} className="rounded-xl bg-cloud px-3">
              <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-2">
                <span className="font-semibold">{r.title}</span>
                <span className="text-xs text-muted">
                  {kinds.find((k) => k.value === r.kind)?.label ?? r.kind}
                  {r.music_key ? ` · ${r.music_key}` : ""}
                </span>
              </summary>
              <div className="flex flex-col gap-2 pb-3">
                {r.body && <p className="whitespace-pre-wrap text-sm">{r.body}</p>}
                {r.url && (
                  <a href={r.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-royal underline">
                    Ouvrir le lien
                  </a>
                )}
                {leader && (
                  <form action={deleteResource} className="self-end">
                    <input type="hidden" name="resource_id" value={r.id} />
                    <SubmitButton className="min-h-11 rounded-full px-3 text-sm font-semibold text-alert-text hover:bg-alert-bg">Retirer</SubmitButton>
                  </form>
                )}
              </div>
            </details>
          ))}
          {leader && (
            <details className="rounded-xl border border-dashed border-line px-3">
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-royal">Ajouter au répertoire</summary>
              <ActionForm action={addResource} hidden={{ group_id: id }} submitLabel="Ajouter" className="flex flex-col gap-3 pb-3">
                <TextField label="Titre" name="title" placeholder="Je lève mes mains" required />
                <div className="grid grid-cols-2 gap-3">
                  <SelectField label="Type" name="kind" options={kinds} />
                  <TextField label="Tonalité" name="music_key" placeholder="Sol majeur" />
                </div>
                <TextAreaField label="Paroles ou texte" name="body" rows={5} />
                <TextField label="Lien (audio, vidéo, document)" name="url" type="url" placeholder="https://…" />
              </ActionForm>
            </details>
          )}
        </Card>
      )}

      {has("activity_reports") && leader && (
        <Card className="flex flex-col gap-3 shadow-card">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ClipboardList aria-hidden className="size-5 text-royal" /> Rapport de rencontre
          </h2>
          <p className="text-sm text-muted">
            {lastReport ? `Dernier rapport : ${formatLongDay(lastReport)}.` : "Aucun rapport pour l'instant."} Sans rapport pendant deux semaines, le pasteur est prévenu.
          </p>
          <ActionForm action={submitReport} hidden={{ group_id: id }} submitLabel="Envoyer le rapport" variant="primary">
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Date" name="meeting_date" type="date" defaultValue={today} />
              <TextField label="Présents" name="present_count" type="number" inputMode="numeric" min={0} required />
            </div>
            <TextField label="Thème" name="theme" />
            <TextAreaField label="Nouveaux venus (un par ligne : Nom Prénom téléphone)" name="newcomers" rows={3} placeholder={"Kouamé Jean 07 08 09 10 11"} />
            <TextAreaField label="Sujets de prière" name="prayer_subjects" rows={2} />
            <TextAreaField label="Besoins" name="needs" rows={2} />
          </ActionForm>
          {((reports ?? []) as { id: string; meeting_date: string; present_count: number; newcomers_count: number; theme: string | null }[]).map((r) => (
            <p key={r.id} className="border-t border-line pt-2 text-sm">
              <span className="font-semibold first-letter:uppercase">{formatShortDay(r.meeting_date)}</span> · {r.present_count} présent{r.present_count > 1 ? "s" : ""}
              {r.newcomers_count ? ` · ${r.newcomers_count} nouveau${r.newcomers_count > 1 ? "x" : ""}` : ""}
              {r.theme ? ` · ${r.theme}` : ""}
            </p>
          ))}
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        {has("announcements") && canSend && (
          <Link href="/messages" className="flex min-h-14 items-center justify-center gap-2 rounded-card bg-surface px-2 text-center text-sm font-semibold text-royal shadow-card">
            <Megaphone aria-hidden className="size-5 shrink-0" /> Écrire au groupe
          </Link>
        )}
        {has("contributions") && (
          <Link href="/cotisations" className="flex min-h-14 items-center justify-center gap-2 rounded-card bg-surface px-2 text-center text-sm font-semibold text-royal shadow-card">
            <Wallet aria-hidden className="size-5 shrink-0" /> Cotisations
          </Link>
        )}
      </div>
    </div>
  );
}
