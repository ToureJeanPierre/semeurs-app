import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Access = {
  personId: string | null;
  /** Droits valables partout (rôles d'église). */
  churchPermissions: string[];
  /** Droits détenus dans au moins un groupe (fonction, rôle de groupe, délégation). */
  groupPermissions: string[];
  roles: string[];
};

export type Scope = "any" | "church" | "group";

/**
 * Droits de la personne connectée (fonction SQL my_access), lus une fois par requête.
 * Ils servent à adapter l'affichage ; la sécurité réelle reste dans les règles RLS.
 */
export const getAccess = cache(async (): Promise<Access> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_access");
  const value = (data ?? {}) as {
    person_id?: string | null;
    church_permissions?: string[];
    group_permissions?: string[];
    roles?: string[];
  };
  return {
    personId: value.person_id ?? null,
    churchPermissions: value.church_permissions ?? [],
    groupPermissions: value.group_permissions ?? [],
    roles: value.roles ?? [],
  };
});

/** Vrai si la personne détient au moins un des droits, dans la portée demandée. */
export function hasAny(access: Access, permissions: string[], scope: Scope = "church"): boolean {
  if (permissions.length === 0) return true;
  const pool =
    scope === "church"
      ? access.churchPermissions
      : scope === "group"
        ? access.groupPermissions
        : [...access.churchPermissions, ...access.groupPermissions];
  return permissions.some((p) => pool.includes(p));
}

/** Arrête l'affichage d'une page si la personne n'a aucun des droits d'église demandés. */
export async function requirePermission(...permissions: string[]): Promise<Access> {
  const access = await getAccess();
  if (!hasAny(access, permissions)) redirect("/");
  return access;
}
