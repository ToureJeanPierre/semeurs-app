import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ServiceType } from "@/lib/services";
import type { DailyVerse } from "@/lib/verses";

export type ChurchProfile = {
  name: string;
  short_name: string;
  tagline?: string;
  welcome_message?: string;
  address?: string;
};

const FALLBACK_PROFILE: ChurchProfile = {
  name: "Église évangélique Les Semeurs de la Parole",
  short_name: "Les Semeurs de la Parole",
};

/**
 * Tout ce qu'affiche l'accueil vient des paramètres (tables settings,
 * service_types, daily_verses), lus au nom de la personne
 * connectée : les règles RLS s'appliquent.
 */
export async function loadHomeData() {
  const supabase = await createClient();
  const [profile, services, verses] = await Promise.all([
    supabase.from("settings").select("value").eq("key", "church_profile").maybeSingle(),
    supabase
      .from("service_types")
      .select("id, name, short_name, weekday, start_time, end_time, place")
      .order("weekday"),
    supabase.from("daily_verses").select("id, reference, text, translation, position"),
  ]);

  return {
    profile: { ...FALLBACK_PROFILE, ...(profile.data?.value as Partial<ChurchProfile> | undefined) },
    services: (services.data ?? []) as ServiceType[],
    verses: (verses.data ?? []) as DailyVerse[],
  };
}
