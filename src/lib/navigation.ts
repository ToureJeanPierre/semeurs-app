import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { hasAny, type Access, type Scope } from "@/lib/access";

export type AppModule = {
  code: string;
  label: string;
  description: string | null;
  icon: string;
  image_url: string | null;
  hero_title: string | null;
  verse_text: string | null;
  verse_ref: string | null;
  href: string | null;
  enabled: boolean;
  home_position: number | null;
  nav_position: number | null;
  required_permissions: string[];
  required_scope: Scope;
};

export type NavLink = { href: string; label: string; icon: string };

/** Adresse d'un module : sa page s'il est activé, sinon sa page « Bientôt ». */
export function moduleHref(m: Pick<AppModule, "code" | "href" | "enabled">): string {
  return m.enabled && m.href ? m.href : `/m/${m.code}`;
}

/** Ne garde que les modules que la personne a le droit de voir (required_permissions). */
export function visibleModules(modules: AppModule[], access: Access): AppModule[] {
  return modules.filter((m) => hasAny(access, m.required_permissions ?? [], m.required_scope ?? "any"));
}

/**
 * Modules lus au nom de la personne connectée (RLS), dans l'ordre de l'accueil.
 * Mis en cache le temps d'une requête (page + cadre de navigation).
 */
export const loadModules = cache(async (): Promise<AppModule[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("modules")
    .select("code, label, description, icon, image_url, hero_title, verse_text, verse_ref, href, enabled, home_position, nav_position, required_permissions, required_scope")
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

/**
 * Menu complet (trois traits) : Accueil, les modules, Profil. Un module pas encore livré
 * n'y figure que s'il est aussi dans la barre du bas (pour éviter les fausses pistes).
 */
export function menuLinks(modules: AppModule[]): (NavLink & { soon: boolean; description: string | null; image: string | null })[] {
  return [
    { href: "/", label: "Accueil", icon: "house", soon: false, description: null, image: null },
    ...modules.filter((m) => m.enabled || m.nav_position !== null).map((m) => ({
      href: moduleHref(m),
      label: m.label,
      icon: m.icon,
      soon: !m.enabled,
      description: m.description,
      image: m.image_url,
    })),
    { href: "/profil", label: "Profil", icon: "user-round", soon: false, description: "Mon compte, verrouillage", image: "/images/modules/profile.webp" },
  ];
}

/** Habillage des onglets (bandeau illustré) : un par adresse de module, lu par PageTitle. */
export function pageArts(modules: AppModule[]): PageArt[] {
  return [
    ...modules
      .filter((m) => m.enabled && m.href)
      .map((m) => ({ href: m.href!, label: m.label, icon: m.icon, image: m.image_url, heroTitle: m.hero_title, verse: m.verse_text, verseRef: m.verse_ref })),
    { href: "/profil", label: "Profil", icon: "user-round", image: "/images/modules/profile.webp", heroTitle: "Mon compte", verse: null, verseRef: null },
  ];
}

export type PageArt = {
  href: string;
  label: string;
  icon: string;
  image: string | null;
  heroTitle: string | null;
  verse: string | null;
  verseRef: string | null;
};

/** Illustration d'un module (vignettes des listes), lue dans la table « modules ». */
export async function moduleImage(code: string): Promise<string | null> {
  return (await loadModules()).find((m) => m.code === code)?.image_url ?? null;
}
