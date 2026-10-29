import Link from "next/link";
import { ChevronRight, Vote } from "lucide-react";
import { getAccess } from "@/lib/access";
import { todayIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

/** Accueil : sondages ouverts auxquels je n'ai pas encore répondu (le module n'est pas dans le menu d'un simple fidèle). */
export async function PendingPolls() {
  const access = await getAccess();
  if (!access.personId) return null;
  const supabase = await createClient();
  const today = todayIso();
  const [{ data: polls }, { data: votes }] = await Promise.all([
    supabase.from("polls").select("id, question, closes_on").or(`closes_on.is.null,closes_on.gte.${today}`),
    supabase.from("poll_votes").select("poll_id").eq("person_id", access.personId),
  ]);
  const done = new Set((votes ?? []).map((v) => v.poll_id));
  const open = (polls ?? []).filter((p) => !done.has(p.id));
  if (open.length === 0) return null;
  return (
    <Link href="/sondages" className="flex items-center gap-3 rounded-card bg-gold/20 p-3 text-sm font-semibold text-night">
      <Vote aria-hidden className="size-6 shrink-0" />
      <span className="flex-1">
        Votre avis compte : {open.length === 1 ? `« ${open[0].question} »` : `${open.length} sondages vous attendent`}
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0" />
    </Link>
  );
}
