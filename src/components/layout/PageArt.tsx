"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { PageArt } from "@/lib/navigation";

const PageArtContext = createContext<PageArt[]>([]);

/** Fournit l'habillage de chaque onglet (illustration, accroche, verset), venu de la table « modules ». */
export function PageArtProvider({ arts, children }: { arts: PageArt[]; children: ReactNode }) {
  return <PageArtContext.Provider value={arts}>{children}</PageArtContext.Provider>;
}

/** L'habillage de l'onglet où l'on se trouve : l'adresse de module la plus longue qui commence la page. */
export function useCurrentArt(): PageArt | null {
  const arts = useContext(PageArtContext);
  const pathname = usePathname();
  return (
    arts
      .filter((a) => a.href !== "/" && (pathname === a.href || pathname.startsWith(`${a.href}/`)))
      .sort((a, b) => b.href.length - a.href.length)[0] ?? null
  );
}
