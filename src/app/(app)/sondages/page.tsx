import type { Metadata } from "next";
import { PageTitle } from "@/components/admin/AdminCard";
import { ListItem } from "@/components/ui/ListItem";
import { moduleImage } from "@/lib/navigation";
import { ActionForm } from "@/components/people/ActionForm";
import { SelectField, TextAreaField } from "@/components/ui/SelectField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { getAccess, hasAny } from "@/lib/access";
import { formatShortDay, todayIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { closePoll, createPoll, vote } from "./actions";

export const metadata: Metadata = { title: "Sondages" };

type Poll = {
  id: string;
  question: string;
  options: string[];
  group_id: string | null;
  anonymous: boolean;
  closes_on: string | null;
  created_by: string | null;
  groups: { name: string } | null;
};
type Result = { option_index: number; votes: number; voters: string[] | null };

/** Sondages : je donne mon avis une fois ; je vois les résultats après avoir voté (jamais qui a voté quoi si anonyme). */
export default async function PollsPage() {
  const access = await getAccess();
  const supabase = await createClient();
  const today = todayIso();
  const [{ data }, { data: myVotes }, { data: myGroups }] = await Promise.all([
    supabase.from("polls").select("id, question, options, group_id, anonymous, closes_on, created_by, groups(name)").order("created_at", { ascending: false }).limit(30),
    supabase.from("poll_votes").select("poll_id, option_index").eq("person_id", access.personId ?? ""),
    supabase.rpc("my_groups_with", { p_permission: "groups.manage" }),
  ]);
  const polls = (data ?? []) as unknown as Poll[];
  const voted = new Map((myVotes ?? []).map((v) => [v.poll_id, v.option_index]));
  const churchManager = hasAny(access, ["polls.manage"]);
  const groups = (myGroups ?? []) as { id: string; name: string }[];
  const canCreate = churchManager || groups.length > 0;
  const art = await moduleImage("polls");
  const results = new Map(
    await Promise.all(
      polls.map(async (p) => {
        const { data: r } = await supabase.rpc("poll_results", { p_poll: p.id });
        return [p.id, (r ?? []) as Result[]] as const;
      }),
    ),
  );

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title="Sondages" intro="Votre avis compte. Un seul vote par personne." />

      {canCreate && (
        <details className="rounded-card bg-surface px-4 shadow-card">
          <summary className="flex min-h-12 cursor-pointer items-center font-semibold text-royal">Lancer un sondage</summary>
          <ActionForm action={createPoll} submitLabel="Lancer" variant="primary" className="flex flex-col gap-3 pb-4">
            <TextField label="Question" name="question" placeholder="Quel jour pour la sortie de la Jeunesse ?" required />
            <TextAreaField label="Réponses possibles (une par ligne)" name="options" placeholder={"Samedi\nDimanche après le culte"} />
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Qui vote"
                name="group_id"
                options={[...(churchManager ? [{ value: "", label: "Toute l'église" }] : []), ...groups.map((g) => ({ value: g.id, label: g.name }))]}
              />
              <TextField label="Jusqu'au" name="closes_on" type="date" />
            </div>
            <label className="flex min-h-11 items-start gap-3 text-sm">
              <input type="checkbox" name="anonymous" defaultChecked className="mt-1 size-5 accent-royal" />
              <span>Vote anonyme (personne ne saura qui a voté quoi)</span>
            </label>
          </ActionForm>
        </details>
      )}

      {polls.length === 0 && <p className="rounded-2xl bg-cloud p-4 text-sm text-muted">Aucun sondage pour l&apos;instant.</p>}
      {polls.map((p) => {
        const closed = !!p.closes_on && p.closes_on < today;
        const mine = voted.get(p.id);
        const r = results.get(p.id) ?? [];
        const total = r.reduce((s, x) => s + Number(x.votes), 0);
        const showResults = mine !== undefined || closed || churchManager || p.created_by === access.personId;
        const canClose = !closed && (churchManager || p.created_by === access.personId);
        return (
          <ListItem
            key={p.id}
            title={p.question}
            tone={closed ? "royal" : mine === undefined ? "gold" : "green"}
            image={art}
            icon="vote"
            badge={closed ? "Clos" : mine === undefined ? "À voter" : "J'ai voté"}
            meta={[
              { icon: "person", text: `${p.groups?.name ?? "Toute l'église"}${p.anonymous ? " · vote anonyme" : ""}` },
              ...(p.closes_on && !closed ? [{ icon: "clock" as const, text: `Jusqu'au ${formatShortDay(p.closes_on)}` }] : []),
            ]}
          >
            {mine === undefined && !closed ? (
              <div className="flex flex-col gap-2">
                {p.options.map((o, i) => (
                  <form key={i} action={vote}>
                    <input type="hidden" name="poll_id" value={p.id} />
                    <input type="hidden" name="option_index" value={i} />
                    <SubmitButton className="min-h-12 w-full rounded-2xl border-2 border-royal/20 px-4 text-left font-semibold text-royal active:bg-royal/10">
                      {o}
                    </SubmitButton>
                  </form>
                ))}
              </div>
            ) : (
              showResults && (
                <ul className="flex flex-col gap-2">
                  {p.options.map((o, i) => {
                    const row = r.find((x) => x.option_index === i);
                    const n = Number(row?.votes ?? 0);
                    const pct = total ? Math.round((n / total) * 100) : 0;
                    return (
                      <li key={i} className="flex flex-col gap-1 text-sm">
                        <span className="flex justify-between gap-2">
                          <span className={mine === i ? "font-semibold text-royal" : ""}>
                            {o}
                            {mine === i ? " (mon choix)" : ""}
                          </span>
                          <span className="font-semibold">
                            {pct} % · {n}
                          </span>
                        </span>
                        <span className="h-2 overflow-hidden rounded-full bg-cloud" aria-hidden>
                          <span className="block h-full rounded-full bg-royal" style={{ width: `${pct}%` }} />
                        </span>
                        {row?.voters && <span className="text-xs text-muted">{row.voters.join(", ")}</span>}
                      </li>
                    );
                  })}
                  <li className="text-xs text-muted">
                    {total} vote{total > 1 ? "s" : ""}
                  </li>
                </ul>
              )
            )}
            {canClose && (
              <form action={closePoll}>
                <input type="hidden" name="poll_id" value={p.id} />
                <SubmitButton className="min-h-11 w-full rounded-full bg-cloud text-sm font-semibold">Clore le sondage</SubmitButton>
              </form>
            )}
          </ListItem>
        );
      })}
    </div>
  );
}
