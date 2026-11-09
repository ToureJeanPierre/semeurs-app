import { UserCog } from "lucide-react";
import { setGroupHelper } from "@/app/actions/group-leaders";
import { PersonPicker, type PersonOption } from "@/components/admin/PersonPicker";
import { ActionForm } from "@/components/people/ActionForm";
import { FormCard } from "@/components/ui/FormCard";
import { getAccess, hasAny } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";

/**
 * « Mes aides » : le père de famille ou le responsable d'équipe désigne lui-même, parmi les membres
 * de son groupe, ceux qui l'aident (fonctions placées sous la sienne : mère de famille, adjoint,
 * trésorière, secrétaire…). Les droits de chaque fonction se règlent dans Administration → Groupes.
 */
export async function GroupHelpers({ groupId, members }: { groupId: string; members: PersonOption[] }) {
  const supabase = await createClient();
  const access = await getAccess();
  const [{ data: group }, { data: mine }] = await Promise.all([
    supabase.from("groups").select("type_id").eq("id", groupId).maybeSingle(),
    supabase
      .from("group_memberships")
      .select("group_functions(rank, permissions)")
      .eq("group_id", groupId)
      .eq("person_id", access.personId ?? "")
      .is("end_date", null),
  ]);
  if (!group) return null;
  const myRank = ((mine ?? []) as unknown as { group_functions: { rank: number; permissions: string[] } | null }[])
    .map((m) => m.group_functions)
    .filter((f): f is { rank: number; permissions: string[] } => !!f && f.permissions.some((p) => p === "people.manage" || p === "groups.manage"))
    .reduce<number | null>((best, f) => (best === null || f.rank < best ? f.rank : best), null);
  const churchAdmin = hasAny(access, ["groups.manage"]);
  if (myRank === null && !churchAdmin) return null;

  const [{ data: functions }, { data: holders }] = await Promise.all([
    supabase.from("group_functions").select("id, label, rank").eq("type_id", group.type_id).order("rank"),
    supabase.from("group_memberships").select("function_id, person_id").eq("group_id", groupId).is("end_date", null).not("function_id", "is", null),
  ]);
  const assignable = (functions ?? []).filter((f) => churchAdmin || f.rank > (myRank ?? 99));
  if (assignable.length === 0) return null;

  return (
    <FormCard title="Mes aides" subtitle="Choisissez parmi vos membres ceux qui vous aident." icon="users-round">
      <ul className="flex flex-col gap-3">
        {assignable.map((f) => {
          const holder = (holders ?? []).find((h) => h.function_id === f.id);
          const holderName = members.find((m) => m.id === holder?.person_id)?.name;
          return (
            <li key={f.id} className="flex flex-col gap-2 rounded-2xl bg-white/80 p-3">
              <p className="flex items-center gap-2 font-semibold text-night">
                <UserCog aria-hidden className="size-4 text-royal" /> {f.label}
                <span className="ml-auto text-sm font-normal text-muted">{holderName ?? "personne"}</span>
              </p>
              <ActionForm action={setGroupHelper} hidden={{ group_id: groupId, function_id: f.id }} submitLabel={holder ? "Changer" : "Désigner"}>
                <PersonPicker name="person_id" label={`${f.label} :`} people={members} defaultId={holder?.person_id} />
              </ActionForm>
              {holder && (
                <ActionForm action={setGroupHelper} hidden={{ group_id: groupId, function_id: f.id, remove: "1" }} submitLabel="Retirer cette fonction" variant="ghost" />
              )}
            </li>
          );
        })}
      </ul>
    </FormCard>
  );
}
