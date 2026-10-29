import type { Metadata } from "next";
import { CalendarDays, MapPin, Trash2 } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { ActionForm } from "@/components/people/ActionForm";
import { Card } from "@/components/ui/Card";
import { FilterChips } from "@/components/ui/FilterChips";
import { ListItem, type Meta, type Tone } from "@/components/ui/ListItem";
import { loadModules } from "@/lib/navigation";
import { SelectField, TextAreaField } from "@/components/ui/SelectField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { getAccess, hasAny } from "@/lib/access";
import { personName } from "@/lib/admin";
import { addDays, formatHour, formatLongDay, todayIso } from "@/lib/format";
import { expandEvents, type GroupEvent } from "@/lib/group-agenda";
import { loadValueList } from "@/lib/people";
import { loadProgram } from "@/lib/program";
import { createClient } from "@/lib/supabase/server";
import { createChurchEvent, deleteChurchEvent, toggleRegistration } from "./actions";

export const metadata: Metadata = { title: "Événements" };

type Item = {
  key: string;
  date: string;
  startsAt: string;
  kind: "culte" | "evenement" | "groupe" | "reunion";
  title: string;
  detail?: string | null;
  people?: string | null;
  href?: string;
  event?: { id: string; registration: boolean; capacity: number | null; count: number; mine: boolean; names: string[]; description: string | null };
};

/** Chaque nature a sa couleur et l'illustration de son module (table « modules »). */
const KIND: Record<Item["kind"], { label: string; tone: Tone; module: string; icon: string }> = {
  culte: { label: "Culte", tone: "gold", module: "services", icon: "circle-play" },
  evenement: { label: "Événement", tone: "teal", module: "events", icon: "calendar-days" },
  groupe: { label: "Mon groupe", tone: "green", module: "my_groups", icon: "network" },
  reunion: { label: "Réunion", tone: "violet", module: "meetings", icon: "video" },
};

/** Agenda de l'église : cultes, événements, activités de mes groupes, mes réunions (30 jours). */
export default async function EventsPage({ searchParams }: PageProps<"/evenements">) {
  const vue = String((await searchParams).vue ?? "tout");
  const access = await getAccess();
  const manager = hasAny(access, ["events.manage"]);
  const supabase = await createClient();
  const today = todayIso();
  const until = addDays(today, 30);
  const [{ data: events }, services, { data: myGroups }, { data: meetings }, kinds, modules] = await Promise.all([
    supabase
      .from("church_events")
      .select("id, title, kind, description, starts_at, ends_at, place, registration, capacity, event_registrations(person_id, people(first_name, last_name))")
      .gte("starts_at", today)
      .lte("starts_at", `${until}T23:59:59Z`)
      .order("starts_at"),
    loadProgram(today, until),
    supabase.rpc("my_groups"),
    supabase.from("meetings").select("id, title, starts_at, place, mode").eq("status", "planned").gte("starts_at", today).lte("starts_at", `${until}T23:59:59Z`),
    loadValueList("event_kind"),
    loadModules(),
  ]);
  const art = (code: string) => modules.find((m) => m.code === code)?.image_url ?? null;
  const groupIds = ((myGroups ?? []) as { id: string; name: string }[]).map((g) => g.id);
  const { data: groupEvents } = groupIds.length
    ? await supabase.from("group_events").select("*, groups(name)").in("group_id", groupIds)
    : { data: [] };

  const items: Item[] = [
    ...(events ?? []).map((e) => {
      const regs = (e.event_registrations ?? []) as unknown as { person_id: string; people: { first_name: string; last_name: string } | null }[];
      return {
        key: `e-${e.id}`,
        date: e.starts_at.slice(0, 10),
        startsAt: e.starts_at,
        kind: "evenement" as const,
        title: e.title,
        detail: [kinds.find((k) => k.value === e.kind)?.label, e.place].filter(Boolean).join(" · "),
        event: {
          id: e.id,
          registration: e.registration,
          capacity: e.capacity,
          count: regs.length,
          mine: regs.some((r) => r.person_id === access.personId),
          names: regs.map((r) => (r.people ? personName(r.people) : "")).filter(Boolean),
          description: e.description,
        },
      };
    }),
    ...services
      .filter((s) => s.published)
      .map((s) => ({
        key: `s-${s.service_id}`,
        date: s.service_date,
        startsAt: s.starts_at,
        kind: "culte" as const,
        title: s.title,
        people: s.positions.filter((p) => p.personName && ["Prédicateur", "Modérateur"].includes(p.position)).map((p) => `${p.position} : ${p.personName}`).join(" · ") || null,
        detail: s.place,
        href: "/cultes",
      })),
    ...expandEvents(((groupEvents ?? []) as (GroupEvent & { group_id: string; groups: { name: string } | null })[]), today, until).map((o) => ({
      key: `g-${o.id}-${o.date}`,
      date: o.date,
      startsAt: o.startsAt,
      kind: "groupe" as const,
      title: o.title,
      detail: [((o as unknown as { groups: { name: string } | null }).groups?.name), o.place].filter(Boolean).join(" · "),
      href: `/mes-groupes/${(o as unknown as { group_id: string }).group_id}`,
    })),
    ...(meetings ?? []).map((m) => ({
      key: `m-${m.id}`,
      date: m.starts_at.slice(0, 10),
      startsAt: m.starts_at,
      kind: "reunion" as const,
      title: m.title,
      detail: m.mode === "online" ? "En ligne" : m.place,
      href: `/reunions/${m.id}`,
    })),
  ]
    .filter((i) => vue === "tout" || (vue === "cultes" && i.kind === "culte") || (vue === "evenements" && i.kind === "evenement") || (vue === "groupes" && (i.kind === "groupe" || i.kind === "reunion")))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const days = new Map<string, Item[]>();
  for (const i of items) days.set(i.date, [...(days.get(i.date) ?? []), i]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title="Événements" intro="Tout ce qui se passe dans les 30 prochains jours." />
      <FilterChips
        items={[
          { v: "tout", label: "Tout", icon: "calendar-days" },
          { v: "cultes", label: "Cultes", icon: "circle-play" },
          { v: "evenements", label: "Événements", icon: "sparkles" },
          { v: "groupes", label: "Mes groupes", icon: "users-round" },
        ].map((c) => ({ href: `/evenements?vue=${c.v}`, label: c.label, icon: c.icon, active: vue === c.v }))}
      />
      {days.size === 0 && <p className="rounded-card bg-surface p-4 text-muted">Rien de prévu pour l&apos;instant.</p>}
      {[...days.entries()].map(([date, list]) => (
        <section key={date} className="flex flex-col gap-2">
          <h2 className="mt-1 flex items-center gap-2 font-display text-lg font-bold text-night first-letter:uppercase">
            <span className="grid size-8 place-items-center rounded-lg bg-royal/10">
              <CalendarDays aria-hidden className="size-4 text-royal" />
            </span>
            {formatLongDay(date)}
          </h2>
          {list.map((i) => {
            const k = KIND[i.kind];
            const meta: Meta[] = [
              { icon: "clock", text: [formatHour(i.startsAt), i.kind === "culte" ? null : i.detail].filter(Boolean).join(" · ") },
              ...(i.people ? [{ icon: "person" as const, text: i.people }] : []),
              ...(i.kind === "culte" && i.detail ? [{ icon: "place" as const, text: i.detail }] : []),
            ];
            return i.event ? (
              <ListItem key={i.key} title={i.title} meta={meta} badge={k.label} tone={k.tone} image={art(k.module)} icon={k.icon}>
                {i.event.description && <p className="whitespace-pre-wrap text-sm">{i.event.description}</p>}
                {i.event.registration && (
                  <form action={toggleRegistration} className="flex items-center gap-3">
                    <input type="hidden" name="event_id" value={i.event.id} />
                    <input type="hidden" name="register" value={i.event.mine ? "0" : "1"} />
                    <SubmitButton
                      disabled={!i.event.mine && i.event.capacity !== null && i.event.count >= i.event.capacity}
                      className={`min-h-11 rounded-full px-4 text-sm font-semibold ${i.event.mine ? "bg-ok-bg text-ok-text" : "bg-royal text-white"}`}
                    >
                      {i.event.mine ? "Inscrit(e) ✓ (annuler)" : i.event.capacity !== null && i.event.count >= i.event.capacity ? "Complet" : "Je m'inscris"}
                    </SubmitButton>
                    <span className="text-sm text-muted">
                      {i.event.count} inscrit{i.event.count > 1 ? "s" : ""}
                      {i.event.capacity ? ` / ${i.event.capacity}` : ""}
                    </span>
                  </form>
                )}
                {manager && i.event.names.length > 0 && (
                  <details className="rounded-xl bg-cloud px-3 text-sm">
                    <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-royal">Liste des inscrits</summary>
                    <p className="pb-3">{i.event.names.join(", ")}</p>
                  </details>
                )}
                {manager && (
                  <form action={deleteChurchEvent} className="self-end">
                    <input type="hidden" name="event_id" value={i.event.id} />
                    <SubmitButton aria-label="Retirer cet événement" className="grid size-11 place-items-center rounded-full text-alert-text hover:bg-alert-bg">
                      <Trash2 aria-hidden className="size-4" />
                    </SubmitButton>
                  </form>
                )}
              </ListItem>
            ) : (
              <ListItem key={i.key} href={i.href} title={i.title} meta={meta} badge={k.label} tone={k.tone} image={art(k.module)} icon={k.icon} />
            );
          })}
        </section>
      ))}
      {manager && (
        <Card className="shadow-card">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
            <MapPin aria-hidden className="size-5 text-royal" /> Annoncer un événement
          </h2>
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
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" name="registration" className="size-5 accent-royal" /> Inscription demandée
            </label>
            <TextField label="Places (facultatif)" name="capacity" inputMode="numeric" />
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
