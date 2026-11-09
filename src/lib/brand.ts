import "server-only";
import { headers } from "next/headers";
import { ADMIN_BRAND, MEMBER_BRAND, type Brand } from "@/lib/brand-shared";

/**
 * Adresses de l'application d'administration : variable ADMIN_APP_HOSTS (liste séparée par des
 * virgules), sinon toute adresse dont le premier mot contient « gestion » ou « admin »
 * (semeurs-gestion.vercel.app, admin.monsite.ci…).
 */
export function isAdminHost(host: string | null): boolean {
  const name = (host ?? "").split(":")[0].toLowerCase();
  const configured = (process.env.ADMIN_APP_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  if (configured.length > 0) return configured.includes(name);
  const first = name.split(".")[0];
  return first.includes("gestion") || first.includes("admin");
}

/** L'habillage de l'application ouverte, d'après l'adresse demandée. */
export async function getBrand(): Promise<Brand> {
  const h = await headers();
  return isAdminHost(h.get("x-forwarded-host") ?? h.get("host")) ? ADMIN_BRAND : MEMBER_BRAND;
}
