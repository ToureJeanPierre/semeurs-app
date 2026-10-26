import type { ReactNode } from "react";
import { BottomNav } from "@/components/ui/BottomNav";
import { requireUser } from "@/lib/auth/session";
import { bottomNavLinks, loadModules, menuLinks, moduleHref } from "@/lib/navigation";
import { AppHeader } from "@/components/layout/AppHeader";

/**
 * Cadre commun des écrans connectés : barre du haut, contenu, barre du bas.
 * Il reste affiché pendant la navigation (seul le contenu change), ce qui
 * évite la page blanche entre deux écrans. Les entrées de navigation
 * viennent de la table « modules ».
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireUser();
  const modules = await loadModules();
  const announcements = modules.find((m) => m.code === "messages");

  return (
    <>
      <AppHeader menu={menuLinks(modules)} bellHref={announcements ? moduleHref(announcements) : "/"} />
      <main className="flex flex-1 flex-col pb-24">{children}</main>
      <BottomNav items={bottomNavLinks(modules)} />
    </>
  );
}
