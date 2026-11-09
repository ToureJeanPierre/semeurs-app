import { requestGroupExit } from "@/app/actions/group-leaders";
import { PersonPicker, type PersonOption } from "@/components/admin/PersonPicker";
import { ActionForm } from "@/components/people/ActionForm";
import { FormCard } from "@/components/ui/FormCard";
import { ReasonPicker } from "@/components/ui/ReasonPicker";
import { formatShortDay } from "@/lib/format";
import { loadValueList } from "@/lib/people";
import { createClient } from "@/lib/supabase/server";

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "En attente", cls: "bg-warn-bg text-warn-text" },
  approved: { label: "Acceptée", cls: "bg-ok-bg text-ok-text" },
  rejected: { label: "Refusée", cls: "bg-cloud text-muted" },
};

/**
 * Retirer un membre (option B de Jean-Pierre, 09/11/2026) : le responsable demande avec un motif ;
 * l'administration ou le pasteur décide. Les dernières demandes du groupe et leur état s'affichent.
 */
export async function GroupExitRequest({ groupId, members }: { groupId: string; members: PersonOption[] }) {
  const supabase = await createClient();
  const [reasons, { data: requests }] = await Promise.all([
    loadValueList("group_exit_reason"),
    supabase
      .from("group_exit_requests")
      .select("id, person_id, reason, status, created_at, decision_note")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "Ancien membre";
  return (
    <FormCard title="Demander le retrait d'un membre" subtitle="L'administration valide ; le membre reste en attendant." icon="users-round">
      <ActionForm action={requestGroupExit} hidden={{ group_id: groupId }} submitLabel="Envoyer la demande">
        <PersonPicker name="person_id" label="Membre concerné" people={members} />
        <ReasonPicker label="Motif" options={reasons} />
      </ActionForm>
      {(requests ?? []).length > 0 && (
        <ul className="mt-3 flex flex-col divide-y divide-line rounded-2xl bg-white/80 px-3 text-sm">
          {(requests ?? []).map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-2 py-2">
              <span className="min-w-0">
                <span className="block font-semibold">{name(r.person_id)}</span>
                <span className="block text-muted">
                  {r.reason} · {formatShortDay(r.created_at.slice(0, 10))}
                  {r.decision_note ? ` · « ${r.decision_note} »` : ""}
                </span>
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[r.status]?.cls}`}>{STATUS[r.status]?.label}</span>
            </li>
          ))}
        </ul>
      )}
    </FormCard>
  );
}
