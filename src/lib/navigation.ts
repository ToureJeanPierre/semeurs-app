import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { hasAny, type Access } from "@/lib/access";

export type AppModule = {
  code: string;
  label: string;
  description: string | null;
  icon: string;
  href: string | null;
  enabled: boolean;
  home_position: number | null;
  nav_position: number | null;
  required_permissions: string[];
};

export type NavLink = { href: string; label: string; icon: string };

/** Adresse d'un module : sa page s'il est activé, sinon sa page « Bientôt ». */
export function moduleHref(m: Pick<AppModule, "code" | "href" | "enabled">): string {
  return m.enabled && m.href ? m.href : `/m/${m.code}`;
}

/** Ne garde que les modules que la personne a le droit de voir (required_permissions). */
export function visibleModules(modules: AppModule[], access: Access): AppModule[] {
  return modules.filter((m) => hasAny(access, m.required_permissions ?? []));
}

/**
 * Modules lus au nom de la personne connectée (RLS), dans l'ordre de l'accueil.
 * Mis en cache le temps d'une requête (page + cadre de navigation).
 */
export const loadModules = cache(async (): Promise<AppModule[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("modules")
    .select("code, label, description, icon, href, enabled, home_position, nav_position, required_permissions")
    .order("home_position", { nullsFirst: false })
    .order("label");
  return (data ?? []) as AppModule[];
});

/** Barre du bas : Accueil, les modules choisis (nav_position), puis Profil. */
export function bottomNavLinks(modules: AppModule[]): NavLink[] {
  const middle = modules
    .filter((m) => m.nav_position !== null)
    .sort((a, b) => a.nav_position! - b.nav_position!)
    .map((m) => ({ href: moduleHref(m), label: m.label, icon: m.icon }));
  return [
    { href: "/", label: "Accueil", icon: "house" },
    ...middle,
    { href: "/profil", label: "Profil", icon: "user-round" },
  ];
}

/** Menu complet (trois points) : Accueil, tous les modules, Profil. */
export function menuLinks(modules: AppModule[]): (NavLink & { soon: boolean; description: string | null })[] {
  return [
    { href: "/", label: "Accueil", icon: "house", soon: false, description: null },
    ...modules.map((m) => ({
      href: moduleHref(m),
      label: m.label,
      icon: m.icon,
      soon: !m.enabled,
      description: m.description,
    })),
    { href: "/profil", label: "Profil", icon: "user-round", soon: false, description: "Mon compte, empreinte" },
  ];
}
