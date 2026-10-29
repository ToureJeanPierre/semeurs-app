import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Trash2, UserMinus } from "lucide-react";
import { GroupForm } from "@/components/admin/GroupForm";
import { PageTitle } from "@/components/admin/AdminCard";
import { PickPersonForm } from "@/components/admin/PickPersonForm";
import { Card } from "@/components/ui/Card";
import { ActionForm } from "@/components/people/ActionForm";
import { TextField } from "@/components/ui/TextField";
import { DoneLink } from "@/components/ui/DoneLink";
import { requirePermission } from "@/lib/access";
import { loadGroupConfig, loadPeopleOptions, personName } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { addGroupMember, archiveGroup, endGroupMembership, setGroupFunction, updateGroup } from "../../actions";

export const metadata: Metadata = { title: "Groupe" };

type Membership = {
  id: string;
  person_id: string;
  function_id: string | null;
  start_date: string;
  people: { first_name: string; last_name: string } | null;
};

const dateFormat = new Intl.DateTimeFormat("fr-CI", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Abidjan" });

export default async function GroupPage({ params }: PageProps<"/administration/groupes/[id]">) {
  await requirePermission("settings.manage", "groups.manage");
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: group }, { types, functions, capabilities }, people, { data: caps }, { data: memberships }] =
    await Promise.all([
      supabase.from("groups").select("id, name, description, color, type_id").eq("id", id).maybeSingle(),
      loadGroupConfig(),
      loadPeopleOptions(),
      supabase.from("group_capabilities").select("capability_code").eq("group_id", id),
      supabase
        .from("group_memberships")
        .select("id, person_id, function_id, start_date, people(first_name, last_name)")
        .eq("group_id", id)
        .is("end_date", null),
    ]);
  if (!group) notFound();
  const type = types.find((t) => t.id === group.type_id)!;
  const bureau = functions.filter((f) => f.type_id === type.id);
  const members = ((memberships ?? []) as unknown as Membership[]).sort((a, b) =>
    personName(a.people!).localeCompare(personName(b.people!), "fr"),
  );
  const memberIds = new Set(members.map((m) => m.person_id));

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 pb-8 pt-5">
      <PageTitle title={group.name} intro={type.name} />

      <section aria-labelledby="bureau" className="flex flex-col gap-3">
        <h2 id="bureau" className="text-lg font-semibold">Bureau</h2>
        <p className="-mt-2 text-sm text-muted">
          Les responsables sont choisis dans la liste des membres de l&apos;église.
        </p>
        {bureau.map((f) => {
          const holder = members.find((m) => m.function_id === f.id);
          return (
            <Card key={f.id} className="shadow-card">
              <PickPersonForm
                action={setGroupFunction}
                hidden={{ group_id: group.id, function_id: f.id }}
                label={f.label}
                people={people}
                defaultId={holder?.person_id}
                submitLabel={holder ? "Changer" : "Désigner"}
              />
            </Card>
          );
        })}
      </section>

      <section aria-labelledby="membres" className="flex flex-col gap-3">
        <h2 id="membres" className="text-lg font-semibold">
          Membres <span className="text-muted">({members.length})</span>
        </h2>
        <Card className="shadow-card">
          <PickPersonForm
            action={addGroupMember}
            hidden={{ group_id: group.id }}
            label="Ajouter un membre"
            people={people.filter((p) => !memberIds.has(p.id))}
            submitLabel="Ajouter au groupe"
          />
        </Card>
        {members.length > 0 && (
          <ul className="flex flex-col divide-y divide-line rounded-card bg-surface px-4 shadow-card">
            {members.map((m) => {
              const fn = bureau.find((f) => f.id === m.function_id);
              return (
                <li key={m.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{personName(m.people!)}</p>
                    <p className="text-sm text-muted">
                      {fn ? `${fn.label} · ` : ""}depuis le {dateFormat.format(new Date(m.start_date))}
                    </p>
                  </div>
                  <form action={endGroupMembership}>
                    <input type="hidden" name="membership_id" value={m.id} />
                    <input type="hidden" name="group_id" value={group.id} />
                    <button
                      type="submit"
                      className="flex min-h-11 items-center gap-1 rounded-full bg-alert-bg px-3 text-sm font-semibold text-alert-text"
                      aria-label={`Retirer ${personName(m.people!)} du groupe`}
                    >
                      <UserMinus aria-hidden className="size-4" /> Retirer
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="reglages" className="flex flex-col gap-3">
        <h2 id="reglages" className="text-lg font-semibold">Réglages du groupe</h2>
        <GroupForm
          action={updateGroup}
          groupId={group.id}
          typeName={type.name}
          defaults={{ name: group.name, description: group.description ?? "", color: group.color ?? type.color }}
          capabilities={capabilities}
          checkedCapabilities={(caps ?? []).map((c) => c.capability_code)}
          submitLabel="Enregistrer"
        />
      </section>
      <details className="rounded-card bg-surface px-4 shadow-card">
        <summary className="flex min-h-12 cursor-pointer items-center gap-2 font-semibold text-alert-text">
          <Trash2 aria-hidden className="size-5" /> Supprimer ce groupe
        </summary>
        <ActionForm action={archiveGroup} hidden={{ group_id: group.id }} submitLabel="Supprimer le groupe" className="flex flex-col gap-3 pb-4">
          <p className="text-sm text-muted">
            « {group.name} » disparaîtra des listes et ses {members.length} membre{members.length > 1 ? "s" : ""} en sortiront (ils restent dans
            l&apos;église, sans ce groupe). L&apos;historique est conservé.
          </p>
          <TextField label="Pour confirmer, écrivez SUPPRIMER" name="confirm" autoComplete="off" required />
        </ActionForm>
      </details>
      <DoneLink href="/administration/groupes" label="Terminer et revenir aux groupes" />
    </div>
  );
}
