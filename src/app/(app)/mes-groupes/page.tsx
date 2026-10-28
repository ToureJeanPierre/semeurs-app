import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { Card } from "@/components/ui/Card";
import { ModuleIcon } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mes groupes" };

type MyGroup = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  type_name: string;
  icon: string;
  my_function: string | null;
  member_count: number;
  bureau: { function: string; name: string }[];
  members: string[] | null;
};

export default async function MyGroupsPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_groups");
  const groups = (data ?? []) as MyGroup[];

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-8 pt-5">
      <PageTitle title="Mes groupes" intro="Votre famille, vos équipes, votre cellule." />
      {groups.length === 0 && (
        <p className="rounded-card bg-surface p-4 text-muted">
          Vous ne faites encore partie d&apos;aucun groupe. Parlez-en à votre père de famille ou à l&apos;administrateur.
        </p>
      )}
      {groups.map((g) => (
        <Card key={g.id} className="flex flex-col gap-3 shadow-card">
          <div className="flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl text-white" style={{ background: g.color }}>
              <ModuleIcon name={g.icon} className="size-6" strokeWidth={1.9} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold">{g.name}</h2>
              <p className="text-sm text-muted">
                {g.type_name}
                {g.my_function ? ` · ${g.my_function}` : ""} · {g.member_count} membre{g.member_count > 1 ? "s" : ""}
              </p>
            </div>
          </div>
          {g.description && <p className="text-sm">{g.description}</p>}
          {g.bureau.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-royal">Bureau</h3>
              <ul className="mt-1 text-sm">
                {g.bureau.map((b) => (
                  <li key={`${b.function}-${b.name}`}>
                    <span className="text-muted">{b.function} : </span>
                    <span className="font-semibold">{b.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {g.members && (
            <div>
              <h3 className="text-sm font-semibold text-royal">Membres</h3>
              <p className="mt-1 text-sm">{g.members.join(", ")}</p>
            </div>
          )}
          <Link href={`/mes-groupes/${g.id}`} className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-royal/10 font-semibold text-royal">
            Ouvrir : agenda, planning, répertoire…
            <ChevronRight aria-hidden className="size-5" />
          </Link>
        </Card>
      ))}
    </div>
  );
}
