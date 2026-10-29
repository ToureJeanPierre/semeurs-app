import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, MapPin, Trash2 } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { ActionForm } from "@/components/people/ActionForm";
import { Card } from "@/components/ui/Card";
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
  href?: string;
  event?: { id: string; registration: boolean; capacity: number | null; count: number; mine: boolean; names: string[]; description: string | null };
};

const KIND_LABEL: Record<Item["kind"], { label: string; cls: string }> = {
  culte: { label: "Culte", cls: "bg-royal text-white" },
  evenement: { label: "Événement", cls: "bg-gold text-night" },
  groupe: { label: "Mon groupe", cls: "bg-ok-bg text-ok-text" },
  reunion: { label: "Réunion", cls: "bg-cloud text-ink" },
};

/** Agenda de l'église : cultes, événements, activités de mes groupes, mes réunions (30 jours). */
export default async function EventsPage({ searchParams }: PageProps<"/evenements">) {
  const vue = String((await searchParams).vue ?? "tout");
  const access = await getAccess();
  const manager = hasAny(access, ["events.manage"]);
  const supabase = await createClient();
  const today = todayIso();
  const until = addDays(today, 30);
  const [{ data: events }, services, { data: myGroups }, { data: meetings }, kinds] = await Promise.all([
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
  ]);
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
        detail: s.positions.filter((p) => p.personName && ["Prédicateur", "Modérateur"].includes(p.position)).map((p) => `${p.position} : ${p.personName}`).join(" · ") || s.place,
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
      <nav aria-label="Filtre" className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {[
          ["tout", "Tout"],
          ["cultes", "Cultes"],
          ["evenements", "Événements"],
          ["groupes", "Mes groupes"],
        ].map(([v, label]) => (
          <Link key={v} href={`/evenements?vue=${v}`} className={`flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold ${vue === v ? "bg-royal text-white" : "bg-surface text-royal shadow-card"}`}>
            {label}
          </Link>
        ))}
      </nav>
      {days.size === 0 && <p className="rounded-card bg-surface p-4 text-muted">Rien de prévu pour l&apos;instant.</p>}
      {[...days.entries()].map(([date, list]) => (
        <section key={date} className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 font-display font-semibold first-letter:uppercase">
            <CalendarDays aria-hidden className="size-5 text-royal" /> {formatLongDay(date)}
          </h2>
          {list.map((i) => {
            const body = (
              <>
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block font-semibold">{i.title}</span>
                    <span className="block text-sm text-muted">
                      {formatHour(i.startsAt)}
                      {i.detail ? ` · ${i.detail}` : ""}
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${KIND_LABEL[i.kind].cls}`}>{KIND_LABEL[i.kind].label}</span>
                </span>
              </>
            );
            return i.event ? (
              <Card key={i.key} className="flex flex-col gap-2 shadow-card">
                {body}
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
              </Card>
            ) : (
              <Link key={i.key} href={i.href ?? "#"} className="flex flex-col gap-1 rounded-card bg-surface p-4 shadow-card active:scale-[0.99]">
                {body}
              </Link>
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
