/**
 * Deux applications installables à partir du même site (demande de Jean-Pierre du 09/11/2026) :
 * l'application des fidèles et l'application d'administration. Chacune a son adresse, donc son
 * propre nom, logo et icône sur le téléphone : on peut installer les deux sans qu'elles se remplacent.
 * Les comptes et les droits sont les mêmes ; seul l'habillage change.
 */
export type Brand = {
  kind: "member" | "admin";
  name: string;
  shortName: string;
  description: string;
  logo: string;
  icons: { icon192: string; icon512: string; maskable512: string; apple: string; favicon: string };
  themeColor: string;
};

export const MEMBER_BRAND: Brand = {
  kind: "member",
  name: "Les Semeurs de la Parole",
  shortName: "Les Semeurs",
  description: "L'application des fidèles de l'Église évangélique Les Semeurs de la Parole, Yopougon.",
  logo: "/logo-semeurs.webp",
  icons: {
    icon192: "/icons/icon-192.png",
    icon512: "/icons/icon-512.png",
    maskable512: "/icons/icon-maskable-512.png",
    apple: "/icons/apple-touch-icon.png",
    favicon: "/icons/favicon-48.png",
  },
  themeColor: "#1546B8",
};

export const ADMIN_BRAND: Brand = {
  kind: "admin",
  name: "Les Semeurs · Administration",
  shortName: "Semeurs Admin",
  description: "L'application d'administration de l'Église évangélique Les Semeurs de la Parole.",
  logo: "/logo-admin.webp",
  icons: {
    icon192: "/icons/admin/icon-192.png",
    icon512: "/icons/admin/icon-512.png",
    maskable512: "/icons/admin/icon-maskable-512.png",
    apple: "/icons/admin/apple-touch-icon.png",
    favicon: "/icons/admin/favicon-48.png",
  },
  themeColor: "#0B2A6F",
};
