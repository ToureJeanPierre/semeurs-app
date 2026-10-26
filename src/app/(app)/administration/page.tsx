import type { Metadata } from "next";
import { KeyRound, SlidersHorizontal, UsersRound, Network } from "lucide-react";
import { AdminLink, PageTitle } from "@/components/admin/AdminCard";
import { hasAny, requirePermission } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Administration" };

export default async function AdministrationPage() {
  const access = await requirePermission("settings.manage", "roles.manage", "groups.manage");
  const supabase = await createClient();
  const [groups, people] = await Promise.all([
    supabase.from("groups").select("id", { count: "exact", head: true }),
    supabase.from("people").select("id", { count: "exact", head: true }),
  ]);

  return (
    <div className="mx-auto w-full max-w-lg px-4 pt-5">
      <PageTitle
        title="Administration"
        intro="Tout se configure ici : groupes, personnes, responsables et paramètres."
      />
      <div className="flex flex-col gap-3">
        <AdminLink
          href="/administration/groupes"
          icon={<Network aria-hidden className="size-6" />}
          title="Groupes"
          detail={`${groups.count ?? 0} groupes : familles, équipes, cellules…`}
        />
        <AdminLink
          href="/administration/personnes"
          icon={<UsersRound aria-hidden className="size-6" />}
          title="Personnes"
          detail={`${people.count ?? 0} personnes au registre`}
        />
        {hasAny(access, ["roles.manage"]) && (
          <AdminLink
            href="/administration/roles"
            icon={<KeyRound aria-hidden className="size-6" />}
            title="Rôles"
            detail="Administrateur, pasteur, assistants, caissiers…"
            accent="var(--color-night)"
          />
        )}
        {hasAny(access, ["settings.manage"]) && (
          <AdminLink
            href="/administration/parametres"
            icon={<SlidersHorizontal aria-hidden className="size-6" />}
            title="Paramètres"
            detail="Seuils d'alerte d'absence"
            accent="var(--color-night)"
          />
        )}
      </div>
    </div>
  );
}
