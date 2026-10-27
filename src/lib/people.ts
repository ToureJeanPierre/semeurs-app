import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ValueOption } from "@/components/people/PersonFields";

/** Une liste de valeurs administrable (statuts, motifs…), dans l'ordre choisi. */
export async function loadValueList(listCode: string): Promise<ValueOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("value_lists")
    .select("value, label")
    .eq("list_code", listCode)
    .eq("active", true)
    .order("position");
  return data ?? [];
}

export const PERSON_COLUMNS =
  "id, first_name, last_name, sex, birth_date, phone, whatsapp, relative_phone, commune, district, landmark, status, marital_status, arrived_at, baptized_at, brought_by, unattached_reason, weekday_exempt";

/** Familles actives (groupes du type à appartenance unique « family »). */
export async function loadFamilies() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("groups")
    .select("id, name, group_types!inner(slug)")
    .eq("group_types.slug", "family")
    .eq("active", true)
    .order("name");
  return (data ?? []).map((g) => ({ id: g.id, name: g.name }));
}
