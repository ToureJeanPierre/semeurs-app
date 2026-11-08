import { NewsTicker, type TickerItem } from "@/components/home/NewsTicker";
import { addDays, formatShortDay, todayIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

/** Annonces de la bande déroulante : mes messages récents (église et groupes), puis les prochains événements. */
export async function NewsTickerLoader() {
  const supabase = await createClient();
  const today = todayIso();
  const [{ data: messages }, { data: events }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, title, body")
      .eq("kind", "message")
      .gte("created_at", addDays(today, -30))
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("church_events")
      .select("id, title, starts_at, place")
      .gte("starts_at", `${today}T00:00:00Z`)
      .lte("starts_at", `${addDays(today, 30)}T23:59:59Z`)
      .order("starts_at")
      .limit(5),
  ]);
  const items: TickerItem[] = [
    ...(messages ?? []).map((m) => ({
      id: `m-${m.id}`,
      text: `${m.title}${m.body ? ` : ${clip(m.body.replace(/\s+/g, " "), 90)}` : ""}`,
      href: "/messages",
    })),
    ...(events ?? []).map((e) => ({
      id: `e-${e.id}`,
      text: `${e.title} · ${formatShortDay(e.starts_at)}${e.place ? ` · ${e.place}` : ""}`,
      href: "/evenements",
    })),
  ];
  if (items.length === 0) {
    items.push({ id: "welcome", text: "Bienvenue aux Semeurs de la Parole : les annonces de l'église s'afficheront ici.", href: "/messages" });
  }
  return <NewsTicker items={items} />;
}
