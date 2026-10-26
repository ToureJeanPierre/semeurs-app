import type { ReactNode } from "react";
import { BottomNav } from "@/components/ui/BottomNav";
import { bottomNavLinks, loadModules, menuLinks, moduleHref } from "@/lib/navigation";
import { AppHeader } from "./AppHeader";

/**
 * Cadre commun des écrans connectés : barre du haut, contenu, barre du bas.
 * Les entrées de navigation viennent de la table « modules ».
 */
export async function AppShell({ title, children }: { title?: string; children: ReactNode }) {
  const modules = await loadModules();
  const announcements = modules.find((m) => m.code === "messages");

  return (
    <>
      <AppHeader
        title={title}
        menu={menuLinks(modules)}
        bellHref={announcements ? moduleHref(announcements) : "/"}
      />
      <main className="flex flex-1 flex-col pb-24">{children}</main>
      <BottomNav items={bottomNavLinks(modules)} />
    </>
  );
}
