import { PromoShowcase, type PromoSlide } from "@/components/home/PromoShowcase";
import { addDays, formatHour, formatLongDay, todayIso } from "@/lib/format";
import { loadModules } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/server";

const DAY = 86_400_000;

function countdown(date: string, today: string): string {
  const days = Math.round((Date.parse(date) - Date.parse(today)) / DAY);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return "Demain";
  return `Dans ${days} jours`;
}

/**
 * Accueil : les bannières animées. Les messages réglés dans Administration → Bannières de l'accueil
 * (actifs, dans leur période), entrecoupés des prochains événements de l'église (30 jours).
 */
export async function PromoSection() {
  const supabase = await createClient();
  const today = todayIso();
  const [{ data: promos }, { data: events }, modules] = await Promise.all([
    supabase
      .from("promo_slides")
      .select("id, eyebrow, title, subtitle, cta_label, cta_href, image_url, image_path, theme, effect, duration_seconds, starts_on, ends_on")
      .eq("active", true)
      .or(`starts_on.is.null,starts_on.lte.${today}`)
      .or(`ends_on.is.null,ends_on.gte.${today}`)
      .order("position"),
    supabase
      .from("church_events")
      .select("id, title, starts_at, place, poster_path, registration")
      .gte("starts_at", `${today}T00:00:00Z`)
      .lte("starts_at", `${addDays(today, 30)}T23:59:59Z`)
      .order("starts_at")
      .limit(5),
    loadModules(),
  ]);
  const paths = [...(promos ?? []).map((p) => p.image_path), ...(events ?? []).map((e) => e.poster_path)].filter((p): p is string => !!p);
  const { data: signed } = paths.length ? await supabase.storage.from("affiches").createSignedUrls(paths, 3600) : { data: [] };
  const url = (p: string | null) => (p ? (signed ?? []).find((s) => s.path === p)?.signedUrl ?? null : null);
  const eventArt = modules.find((m) => m.code === "events");
  const eventIllustration = eventArt?.hero_image ?? eventArt?.image_url ?? null;

  const promoSlides: PromoSlide[] = (promos ?? []).map((p) => {
    const uploaded = url(p.image_path);
    return {
      id: p.id,
      eyebrow: p.eyebrow,
      title: p.title,
      subtitle: p.subtitle,
      ctaLabel: p.cta_label,
      ctaHref: p.cta_href,
      image: uploaded ?? p.image_url,
      isPhoto: !!uploaded,
      theme: p.theme,
      effect: p.effect,
      duration: p.duration_seconds,
    };
  });
  const eventSlides: PromoSlide[] = (events ?? []).map((e, i) => {
    const poster = url(e.poster_path);
    const when = formatLongDay(e.starts_at);
    return {
      id: `event-${e.id}`,
      eyebrow: countdown(e.starts_at.slice(0, 10), today),
      title: e.title,
      subtitle: `${when.charAt(0).toUpperCase()}${when.slice(1)} · ${formatHour(e.starts_at)}${e.place ? ` · ${e.place}` : ""}`,
      ctaLabel: e.registration ? "Je m'inscris" : "Voir l'événement",
      ctaHref: "/evenements",
      image: poster ?? eventIllustration,
      isPhoto: !!poster,
      theme: i % 2 === 0 ? "sunset" : "night",
      effect: "mix",
      duration: 6,
    };
  });

  // Une bannière, un événement, une bannière… pour varier.
  const slides: PromoSlide[] = [];
  for (let i = 0; i < Math.max(promoSlides.length, eventSlides.length); i++) {
    if (promoSlides[i]) slides.push(promoSlides[i]);
    if (eventSlides[i]) slides.push(eventSlides[i]);
  }
  return <PromoShowcase slides={slides} />;
}
