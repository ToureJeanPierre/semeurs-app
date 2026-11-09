"use client";

import { createContext, useContext, type ReactNode } from "react";
import { MEMBER_BRAND, type Brand } from "@/lib/brand-shared";

const BrandContext = createContext<Brand>(MEMBER_BRAND);

/** Habillage (nom, logo) de l'application ouverte : celle des fidèles ou celle de l'administration. */
export function BrandProvider({ brand, children }: { brand: Brand; children: ReactNode }) {
  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}

export const useBrand = () => useContext(BrandContext);
