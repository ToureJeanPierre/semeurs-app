import type { ReactNode } from "react";
import { BottomNav } from "@/components/ui/BottomNav";
import { requireUser } from "@/lib/auth/session";
import { getAccess } from "@/lib/access";
import { bottomNavLinks, loadModules, menuLinks, pageArts, visibleModules } from "@/lib/navigation";
import { PageArtProvider } from "@/components/layout/PageArt";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/layout/AppHeader";
import { NavTrailTracker } from "@/components/layout/NavTrail";

/**
 * Cadre commun des écrans connectés : barre du haut, contenu, barre du bas.
 * Il reste affiché pendant la navigation (seul le contenu change), ce qui
 * évite la page blanche entre deux écrans. Les entrées de navigation
 * viennent de la table « modules ».
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireUser();
  const supabase = await createClient();
  const [allModules, access, { data: unread }] = await Promise.all([
    loadModules(),
    getAccess(),
    supabase.rpc("unread_notifications"),
  ]);
  const modules = visibleModules(allModules, access);

  return (
    <PageArtProvider arts={pageArts(allModules)}>
      <AppHeader menu={menuLinks(modules)} unread={unread ?? 0} />
      <main className="flex flex-1 flex-col pb-24">{children}</main>
      <BottomNav items={bottomNavLinks(modules)} />
      <NavTrailTracker />
    </PageArtProvider>
  );
}
