import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Réglages du programme des cultes (table settings, modifiables sans recoder). */
export async function loadProgramSettings(): Promise<{ positions: string[]; periods: number[] }> {
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("key, value").in("key", ["program_positions", "moderation_periods"]);
  const get = (key: string) => data?.find((s) => s.key === key)?.value;
  return {
    positions: (get("program_positions") as string[] | undefined) ?? ["Modérateur", "Prédicateur"],
    periods: (get("moderation_periods") as number[] | undefined) ?? [2, 3, 6],
  };
}

export type ProgramRow = {
  service_id: string;
  service_date: string;
  starts_at: string;
  title: string;
  place: string | null;
  theme: string | null;
  exceptional: boolean;
  published: boolean;
  position_id: string | null;
  position: string | null;
  rank: number | null;
  person_id: string | null;
  person_name: string | null;
  position_theme: string | null;
  bible_text: string | null;
};

export type ProgramService = Omit<ProgramRow, "position_id" | "position" | "rank" | "person_id" | "person_name" | "position_theme" | "bible_text"> & {
  positions: { id: string; position: string; personId: string | null; personName: string | null; theme: string | null; bibleText: string | null }[];
};

/** Programme d'une période, regroupé par culte (fonction program_view : noms seulement). */
export async function loadProgram(from: string, to: string): Promise<ProgramService[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("program_view", { p_from: from, p_to: to });
  const services = new Map<string, ProgramService>();
  for (const r of (data ?? []) as ProgramRow[]) {
    let s = services.get(r.service_id);
    if (!s) {
      s = {
        service_id: r.service_id,
        service_date: r.service_date,
        starts_at: r.starts_at,
        title: r.title,
        place: r.place,
        theme: r.theme,
        exceptional: r.exceptional,
        published: r.published,
        positions: [],
      };
      services.set(r.service_id, s);
    }
    if (r.position_id && r.position) {
      s.positions.push({
        id: r.position_id,
        position: r.position,
        personId: r.person_id,
        personName: r.person_name,
        theme: r.position_theme,
        bibleText: r.bible_text,
      });
    }
  }
  return [...services.values()];
}
