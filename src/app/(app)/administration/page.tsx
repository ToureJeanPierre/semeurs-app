import type { Metadata } from "next";
import { GalleryHorizontalEnd, KeyRound, UserMinus, ListChecks, SlidersHorizontal, UsersRound, Network } from "lucide-react";
import { AdminLink, PageTitle } from "@/components/admin/AdminCard";
import { hasAny, requirePermission } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Administration" };

export default async function AdministrationPage() {
  const access = await requirePermission("settings.manage", "roles.manage", "groups.manage", "promos.manage", "people.manage");
  const supabase = await createClient();
  const [groups, people, exits] = await Promise.all([
    supabase.from("groups").select("id", { count: "exact", head: true }),
    supabase.from("people").select("id", { count: "exact", head: true }),
    supabase.from("group_exit_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  return (
    <div className="mx-auto w-full max-w-lg px-4 pt-5">
      <PageTitle
        title="Administration"
        intro="Tout se configure ici : groupes, personnes, responsables et paramètres."
      />
      <div className="flex flex-col gap-3">
        {hasAny(access, ["groups.manage", "people.manage"]) && (
          <AdminLink
            href="/administration/demandes"
            icon={<UserMinus aria-hidden className="size-6" />}
            title={`Demandes de retrait${exits.count ? ` (${exits.count} en attente)` : ""}`}
            detail="Les pères de famille et responsables demandent qu'un membre quitte leur groupe"
            accent={exits.count ? "var(--color-alert-ring)" : undefined}
          />
        )}
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
        {hasAny(access, ["promos.manage"]) && (
          <AdminLink
            href="/administration/bannieres"
            icon={<GalleryHorizontalEnd aria-hidden className="size-6" />}
            title="Bannières de l'accueil"
            detail="Messages animés qui défilent sur l'accueil : textes, images, effets"
            accent="var(--color-gold)"
          />
        )}
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
            detail="Seuils d'alerte, messages préparés, postes du programme"
            accent="var(--color-night)"
          />
        )}
        {hasAny(access, ["settings.manage"]) && (
          <AdminLink
            href="/administration/listes"
            icon={<ListChecks aria-hidden className="size-6" />}
            title="Listes et parcours"
            detail="Statuts, types de cotisation, moyens de paiement, étapes d'intégration…"
            accent="var(--color-night)"
          />
        )}
      </div>
    </div>
  );
}
