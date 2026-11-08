import { EvangelismHome } from "@/components/home/EvangelismHome";
import { addDays, todayIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

/** Nombre de personnes rencontrées à (ré)inviter : les miennes, ou toutes pour l'équipe (règles de la base). */
export async function EvangelismHomeLoader() {
  const supabase = await createClient();
  const today = todayIso();
  const { count } = await supabase
    .from("outreach_contacts")
    .select("id", { count: "exact", head: true })
    .is("person_id", null)
    .not("phone", "is", null)
    .gte("created_at", addDays(today, -90))
    .or(`invited_on.is.null,invited_on.lt.${addDays(today, -6)}`);
  return <EvangelismHome toInvite={count ?? 0} />;
}
