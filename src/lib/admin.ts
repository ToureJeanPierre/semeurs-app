import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PersonOption } from "@/components/admin/PersonPicker";
import { formatPhone, parseIvorianPhone } from "@/lib/phone";

export type GroupType = {
  id: string;
  slug: string;
  name: string;
  name_plural: string;
  icon: string;
  color: string;
  single_membership: boolean;
  default_capabilities: string[];
};

export type GroupFunction = { id: string; type_id: string; label: string; rank: number };
export type Capability = { code: string; label: string; description: string; available: boolean };

export function personName(p: { first_name: string; last_name: string }) {
  return `${p.last_name.toUpperCase()} ${p.first_name}`;
}

/** Personnes visibles (RLS), triées par nom, pour les listes de choix. */
export async function loadPeopleOptions(): Promise<PersonOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("people")
    .select("id, first_name, last_name, phone, commune")
    .order("last_name")
    .order("first_name");
  return (data ?? []).map((p) => {
    const phone = p.phone ? parseIvorianPhone(p.phone) : null;
    return {
      id: p.id,
      name: personName(p),
      detail: [phone ? formatPhone(phone) : null, p.commune].filter(Boolean).join(" · ") || null,
    };
  });
}

export async function loadGroupConfig() {
  const supabase = await createClient();
  const [types, functions, capabilities] = await Promise.all([
    supabase
      .from("group_types")
      .select("id, slug, name, name_plural, icon, color, single_membership, default_capabilities")
      .eq("active", true)
      .order("position"),
    supabase.from("group_functions").select("id, type_id, label, rank").order("rank"),
    supabase.from("capabilities").select("code, label, description, available").order("position"),
  ]);
  return {
    types: (types.data ?? []) as GroupType[],
    functions: (functions.data ?? []) as GroupFunction[],
    capabilities: (capabilities.data ?? []) as Capability[],
  };
}
