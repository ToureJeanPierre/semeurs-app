import { EventsCarousel, type CarouselEvent } from "@/components/home/EventsCarousel";
import { formatHour, formatLongDay, todayIso } from "@/lib/format";
import { loadModules } from "@/lib/navigation";
import { loadValueList } from "@/lib/people";
import { createClient } from "@/lib/supabase/server";

const DAY = 86_400_000;

function countdown(date: string, today: string): string {
  const days = Math.round((Date.parse(date) - Date.parse(today)) / DAY);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return "Demain";
  return `Dans ${days} jours`;
}

/** Accueil : les prochains événements de l'église, avec leur affiche, pour le carrousel animé. */
export async function HomeEvents() {
  const supabase = await createClient();
  const today = todayIso();
  const [{ data }, kinds, modules] = await Promise.all([
    supabase
      .from("church_events")
      .select("id, title, kind, starts_at, ends_at, place, poster_path")
      .gte("starts_at", `${today}T00:00:00Z`)
      .order("starts_at")
      .limit(6),
    loadValueList("event_kind"),
    loadModules(),
  ]);
  const rows = data ?? [];
  if (rows.length === 0) return null;
  const paths = rows.map((r) => r.poster_path).filter((p): p is string => !!p);
  const { data: signed } = paths.length ? await supabase.storage.from("affiches").createSignedUrls(paths, 3600) : { data: [] };
  const url = (p: string | null) => (p ? signed?.find((s) => s.path === p)?.signedUrl ?? null : null);
  const fallback = modules.find((m) => m.code === "events");
  const illustration = fallback?.hero_image ?? fallback?.image_url ?? "/images/heroes/events.webp";

  const events: CarouselEvent[] = rows.map((r) => {
    const poster = url(r.poster_path);
    const day = r.starts_at.slice(0, 10);
    const when = formatLongDay(r.starts_at);
    return {
      id: r.id,
      title: r.title,
      kind: kinds.find((k) => k.value === r.kind)?.label ?? "Événement",
      when: `${when.charAt(0).toUpperCase()}${when.slice(1)} · ${formatHour(r.starts_at)}`,
      countdown: countdown(day, today),
      place: r.place,
      image: poster ?? illustration,
      isPoster: !!poster,
    };
  });
  return <EventsCarousel events={events} />;
}
