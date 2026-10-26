import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Access = {
  personId: string | null;
  churchPermissions: string[];
  roles: string[];
};

/**
 * Droits de la personne connectée (fonction SQL my_access), lus une fois par requête.
 * Ils servent à adapter l'affichage ; la sécurité réelle reste dans les règles RLS.
 */
export const getAccess = cache(async (): Promise<Access> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_access");
  const value = (data ?? {}) as { person_id?: string | null; church_permissions?: string[]; roles?: string[] };
  return {
    personId: value.person_id ?? null,
    churchPermissions: value.church_permissions ?? [],
    roles: value.roles ?? [],
  };
});

export function hasAny(access: Access, permissions: string[]): boolean {
  return permissions.length === 0 || permissions.some((p) => access.churchPermissions.includes(p));
}

/** Arrête l'affichage d'une page si la personne n'a aucun des droits demandés. */
export async function requirePermission(...permissions: string[]): Promise<Access> {
  const access = await getAccess();
  if (!hasAny(access, permissions)) redirect("/");
  return access;
}
