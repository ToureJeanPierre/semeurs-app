import type { Metadata } from "next";
import { UserMinus } from "lucide-react";
import { decideGroupExit } from "@/app/actions/group-leaders";
import { PageTitle } from "@/components/admin/AdminCard";
import { ActionForm } from "@/components/people/ActionForm";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { requirePermission } from "@/lib/access";
import { personName } from "@/lib/admin";
import { formatShortDay } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Demandes de retrait" };

type Request = {
  id: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  decided_at: string | null;
  decision_note: string | null;
  groups: { name: string } | null;
  person: { first_name: string; last_name: string } | null;
  asker: { first_name: string; last_name: string } | null;
};

/** Les demandes de retrait envoyées par les pères de famille et les responsables : accepter ou refuser. */
export default async function ExitRequestsPage() {
  await requirePermission("groups.manage", "people.manage");
  const supabase = await createClient();
  const { data } = await supabase
    .from("group_exit_requests")
    .select(
      "id, reason, status, created_at, decided_at, decision_note, groups(name), person:people!group_exit_requests_person_id_fkey(first_name, last_name), asker:people!group_exit_requests_requested_by_fkey(first_name, last_name)",
    )
    .order("created_at", { ascending: false })
    .limit(40);
  const rows = (data ?? []) as unknown as Request[];
  const pending = rows.filter((r) => r.status === "pending");
  const done = rows.filter((r) => r.status !== "pending");

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title="Demandes de retrait" intro="Un père de famille ou un responsable demande qu'un membre quitte son groupe : vous décidez." />

      {pending.length === 0 && <p className="rounded-card bg-surface p-4 text-muted">Aucune demande en attente.</p>}
      {pending.map((r) => (
        <Card key={r.id} className="flex flex-col gap-3 shadow-card">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-warn-bg text-warn-text">
              <UserMinus aria-hidden className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display font-bold text-night">{r.person ? personName(r.person) : "Membre"}</span>
              <span className="block text-sm text-muted">
                Quitter « {r.groups?.name} » · demandé par {r.asker ? personName(r.asker) : "un responsable"} le {formatShortDay(r.created_at.slice(0, 10))}
              </span>
              <span className="mt-1 block rounded-xl bg-cloud px-3 py-2 text-sm">Motif : {r.reason}</span>
            </span>
          </div>
          <ActionForm action={decideGroupExit} hidden={{ request_id: r.id, approve: "1" }} submitLabel="Accepter : retirer du groupe" variant="primary">
            <TextField label="Message au demandeur (facultatif)" name="note" />
          </ActionForm>
          <details className="rounded-xl bg-cloud px-3">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-alert-text">Refuser</summary>
            <ActionForm action={decideGroupExit} hidden={{ request_id: r.id, approve: "0" }} submitLabel="Refuser la demande" className="flex flex-col gap-3 pb-3">
              <TextField label="Pourquoi ? (facultatif)" name="note" />
            </ActionForm>
          </details>
        </Card>
      ))}

      {done.length > 0 && (
        <details className="rounded-card bg-surface px-4 shadow-card">
          <summary className="flex min-h-12 cursor-pointer items-center font-display font-bold text-night">Demandes traitées ({done.length})</summary>
          <ul className="flex flex-col divide-y divide-line pb-3 text-sm">
            {done.map((r) => (
              <li key={r.id} className="py-2">
                <span className="font-semibold">{r.person ? personName(r.person) : "Membre"}</span> · {r.groups?.name} ·{" "}
                <span className={r.status === "approved" ? "font-semibold text-ok-text" : "text-muted"}>{r.status === "approved" ? "acceptée" : "refusée"}</span>
                {r.decided_at ? ` le ${formatShortDay(r.decided_at.slice(0, 10))}` : ""}
                <span className="block text-muted">Motif : {r.reason}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
