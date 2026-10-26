import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AdminLink, PageTitle } from "@/components/admin/AdminCard";
import { ModuleIcon } from "@/components/ui/icons";
import { requirePermission } from "@/lib/access";
import { loadGroupConfig, personName } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Groupes" };

type GroupRow = {
  id: string;
  name: string;
  type_id: string;
  color: string | null;
  group_memberships: {
    end_date: string | null;
    group_functions: { rank: number; label: string } | null;
    people: { first_name: string; last_name: string } | null;
  }[];
};

export default async function GroupsPage() {
  await requirePermission("settings.manage", "groups.manage");
  const supabase = await createClient();
  const [{ types }, { data }] = await Promise.all([
    loadGroupConfig(),
    supabase
      .from("groups")
      .select(
        "id, name, type_id, color, group_memberships(end_date, group_functions(rank, label), people(first_name, last_name))",
      )
      .order("name"),
  ]);
  const groups = (data ?? []) as unknown as GroupRow[];

  return (
    <div className="mx-auto w-full max-w-lg px-4 pt-5">
      <PageTitle
        title="Groupes"
        intro="Familles, équipes, cellules, Jeunesse, classes : chaque groupe fonctionne dès sa création."
      />
      <div className="flex flex-col gap-7">
        {types.map((type) => {
          const list = groups.filter((g) => g.type_id === type.id);
          return (
            <section key={type.id} aria-labelledby={`type-${type.slug}`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 id={`type-${type.slug}`} className="text-lg font-semibold">
                  {type.name_plural} <span className="text-muted">({list.length})</span>
                </h2>
                <Link
                  href={`/administration/groupes/nouveau?type=${type.slug}`}
                  className="inline-flex min-h-11 items-center gap-1 rounded-full bg-royal px-4 text-sm font-semibold text-white"
                >
                  <Plus aria-hidden className="size-4" />
                  Ajouter
                </Link>
              </div>
              <div className="flex flex-col gap-2">
                {list.length === 0 && (
                  <p className="rounded-card bg-surface p-4 text-sm text-muted">
                    Aucun groupe pour l&apos;instant.
                  </p>
                )}
                {list.map((g) => {
                  const active = g.group_memberships.filter((m) => !m.end_date);
                  const leader = active
                    .filter((m) => m.group_functions && m.people)
                    .sort((a, b) => a.group_functions!.rank - b.group_functions!.rank)[0];
                  return (
                    <AdminLink
                      key={g.id}
                      href={`/administration/groupes/${g.id}`}
                      icon={<ModuleIcon name={type.icon} className="size-6" strokeWidth={1.9} />}
                      accent={g.color ?? type.color}
                      title={g.name}
                      detail={
                        leader
                          ? `${leader.group_functions!.label} : ${personName(leader.people!)} · ${active.length} membre${active.length > 1 ? "s" : ""}`
                          : `Responsable à désigner · ${active.length} membre${active.length > 1 ? "s" : ""}`
                      }
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
