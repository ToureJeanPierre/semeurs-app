import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { DoneLink } from "@/components/ui/DoneLink";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { formatLongDay } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { toggleGroupPresence } from "../../../actions";

export const metadata: Metadata = { title: "Pointer la rencontre" };

/** Pointage d'une rencontre de groupe par son responsable (un geste par membre). */
export default async function GroupSessionPage({ params }: PageProps<"/mes-groupes/[id]/pointage/[session]">) {
  const { id, session } = await params;
  const supabase = await createClient();
  const [{ data: s }, { data: roster, error }] = await Promise.all([
    supabase.from("sessions").select("title, session_date, group_id").eq("id", session).maybeSingle(),
    supabase.rpc("group_roster", { p_session: session }),
  ]);
  if (!s || s.group_id !== id || error) notFound();
  const rows = (roster ?? []) as { person_id: string; name: string; present: boolean }[];
  const count = rows.filter((r) => r.present).length;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title={s.title} intro={<span className="first-letter:uppercase">{formatLongDay(s.session_date)} · {count} / {rows.length} présent{count > 1 ? "s" : ""}</span>} />
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.person_id}>
            <form action={toggleGroupPresence}>
              <input type="hidden" name="session_id" value={session} />
              <input type="hidden" name="group_id" value={id} />
              <input type="hidden" name="person_id" value={r.person_id} />
              <input type="hidden" name="present" value={r.present ? "0" : "1"} />
              <SubmitButton
                aria-pressed={r.present}
                className={`flex min-h-14 w-full items-center gap-3 rounded-card border-2 px-4 text-left font-semibold ${r.present ? "border-ok-ring bg-ok-bg text-ok-text" : "border-transparent bg-surface shadow-card"}`}
              >
                {r.present ? <CheckCircle2 aria-hidden className="size-6" /> : <Circle aria-hidden className="size-6 text-muted" />}
                <span className="flex-1">{r.name}</span>
                <span className="text-sm">{r.present ? "Présent(e)" : ""}</span>
              </SubmitButton>
            </form>
          </li>
        ))}
      </ul>
      <DoneLink href={`/mes-groupes/${id}`} label="Terminer" />
    </div>
  );
}
