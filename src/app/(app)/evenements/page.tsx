import type { Metadata } from "next";
import { CalendarDays, Trash2 } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { ActionForm } from "@/components/people/ActionForm";
import { PosterPicker } from "@/components/events/PosterPicker";
import { FormCard } from "@/components/ui/FormCard";
import { ListItem, type Meta } from "@/components/ui/ListItem";
import { SelectField, TextAreaField } from "@/components/ui/SelectField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { getAccess, hasAny } from "@/lib/access";
import { personName } from "@/lib/admin";
import { addDays, formatHour, formatLongDay, formatShortDay, todayIso } from "@/lib/format";
import { moduleImage } from "@/lib/navigation";
import { loadValueList } from "@/lib/people";
import { createClient } from "@/lib/supabase/server";
import { createChurchEvent, deleteChurchEvent, toggleRegistration } from "./actions";

export const metadata: Metadata = { title: "Événements" };

type EventRow = {
  id: string;
  title: string;
  kind: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  place: string | null;
  registration: boolean;
  capacity: number | null;
  poster_path: string | null;
  event_registrations: { person_id: string; people: { first_name: string; last_name: string } | null }[];
};

/**
 * Les événements de l'église : croisades, conventions, veillées, sorties, conférences…
 * Les cultes sont dans « Cultes », les activités des groupes (répétitions…) dans chaque groupe,
 * les réunions dans « Réunions » (demande de Jean-Pierre du 01/11/2026). Les événements passés
 * restent consultables (historique).
 */
export default async function EventsPage() {
  const access = await getAccess();
  const manager = hasAny(access, ["events.manage"]);
  const supabase = await createClient();
  const today = todayIso();
  const [{ data }, kinds, art] = await Promise.all([
    supabase
      .from("church_events")
      .select("id, title, kind, description, starts_at, ends_at, place, registration, capacity, poster_path, event_registrations(person_id, people(first_name, last_name))")
      .gte("starts_at", addDays(today, -365))
      .order("starts_at"),
    loadValueList("event_kind"),
    moduleImage("events"),
  ]);
  const events = (data ?? []) as unknown as EventRow[];
  const posterPaths = events.map((e) => e.poster_path).filter((p): p is string => !!p);
  const { data: signed } = posterPaths.length ? await supabase.storage.from("affiches").createSignedUrls(posterPaths, 3600) : { data: [] };
  const poster = (p: string | null) => (p ? (signed ?? []).find((x) => x.path === p)?.signedUrl ?? null : null);
  const upcoming = events.filter((e) => (e.ends_at ?? e.starts_at).slice(0, 10) >= today);
  const past = events.filter((e) => !upcoming.includes(e)).reverse();
  const kindLabel = (k: string) => kinds.find((x) => x.value === k)?.label ?? "Événement";

  const card = (e: EventRow, isPast: boolean) => {
    const mine = e.event_registrations.some((r) => r.person_id === access.personId);
    const count = e.event_registrations.length;
    const full = e.capacity !== null && count >= e.capacity;
    const meta: Meta[] = [
      { icon: "clock", text: `${formatLongDay(e.starts_at)} · ${formatHour(e.starts_at)}${e.ends_at ? ` → ${formatShortDay(e.ends_at)} ${formatHour(e.ends_at)}` : ""}` },
      ...(e.place ? [{ icon: "place" as const, text: e.place }] : []),
    ];
    return (
      <ListItem key={e.id} title={e.title} meta={meta} badge={kindLabel(e.kind)} tone={isPast ? "royal" : "teal"} image={poster(e.poster_path) ?? art} icon="calendar-days">
        {e.description && <p className="whitespace-pre-wrap text-sm">{e.description}</p>}
        {e.registration && !isPast && (
          <form action={toggleRegistration} className="flex items-center gap-3">
            <input type="hidden" name="event_id" value={e.id} />
            <input type="hidden" name="register" value={mine ? "0" : "1"} />
            <SubmitButton
              disabled={!mine && full}
              className={`min-h-11 rounded-full px-4 text-sm font-semibold ${mine ? "bg-ok-bg text-ok-text" : "bg-royal text-white"}`}
            >
              {mine ? "Inscrit(e) ✓ (annuler)" : full ? "Complet" : "Je m'inscris"}
            </SubmitButton>
            <span className="text-sm text-muted">
              {count} inscrit{count > 1 ? "s" : ""}
              {e.capacity ? ` / ${e.capacity}` : ""}
            </span>
          </form>
        )}
        {e.registration && isPast && (
          <p className="text-sm text-muted">
            {count} personne{count > 1 ? "s" : ""} inscrite{count > 1 ? "s" : ""}
          </p>
        )}
        {manager && count > 0 && (
          <details className="rounded-xl bg-cloud px-3 text-sm">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-royal">Liste des inscrits</summary>
            <p className="pb-3">{e.event_registrations.map((r) => (r.people ? personName(r.people) : "")).filter(Boolean).join(", ")}</p>
          </details>
        )}
        {manager && !isPast && (
          <form action={deleteChurchEvent} className="self-end">
            <input type="hidden" name="event_id" value={e.id} />
            <SubmitButton aria-label="Retirer cet événement" className="grid size-11 place-items-center rounded-full text-alert-text hover:bg-alert-bg">
              <Trash2 aria-hidden className="size-4" />
            </SubmitButton>
          </form>
        )}
      </ListItem>
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title="Événements" intro="Croisades, conventions, veillées, sorties : les grands rendez-vous de l'église." />

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-night">
          <span className="grid size-8 place-items-center rounded-lg bg-royal/10">
            <CalendarDays aria-hidden className="size-4 text-royal" />
          </span>
          À venir
        </h2>
        {upcoming.length === 0 && <p className="rounded-card bg-surface p-4 text-muted">Aucun événement annoncé pour l&apos;instant.</p>}
        {upcoming.map((e) => card(e, false))}
      </section>

      {past.length > 0 && (
        <details className="rounded-card bg-surface px-4 shadow-card">
          <summary className="flex min-h-12 cursor-pointer items-center font-display font-bold text-night">Historique ({past.length})</summary>
          <div className="flex flex-col gap-3 pb-4">{past.map((e) => card(e, true))}</div>
        </details>
      )}

      {manager && (
        <FormCard title="Annoncer un événement" subtitle="Tous les fidèles seront prévenus." icon="megaphone">
          <ActionForm action={createChurchEvent} submitLabel="Publier et annoncer" variant="primary">
            <TextField label="Titre" name="title" placeholder="Grande croisade d'évangélisation" required />
            <SelectField label="Type" name="kind" options={kinds} />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Date" name="date" type="date" defaultValue={addDays(today, 7)} />
              <TextField label="Heure" name="start" type="time" defaultValue="18:00" />
              <TextField label="Fin (date)" name="end_date" type="date" />
              <TextField label="Fin (heure)" name="end" type="time" />
            </div>
            <TextField label="Lieu" name="place" />
            <TextAreaField label="Présentation" name="description" rows={3} />
            <PosterPicker />
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" name="registration" className="size-5 accent-royal" /> Inscription demandée
            </label>
            <TextField label="Places (facultatif)" name="capacity" inputMode="numeric" />
          </ActionForm>
        </FormCard>
      )}
    </div>
  );
}
