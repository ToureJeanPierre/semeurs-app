import { getBrand } from "@/lib/brand";

/**
 * Manifeste de l'application installée, selon l'adresse : fidèles ou administration. Chaque adresse
 * est une application distincte pour le téléphone (identifiant, nom et icône propres) : installer
 * l'une ne remplace jamais l'autre.
 */
export async function GET() {
  const brand = await getBrand();
  const manifest = {
    // Identifiants différents en plus des adresses différentes : le téléphone ne peut jamais confondre les deux.
    id: brand.kind === "admin" ? "/?app=semeurs-admin" : "/?app=semeurs-fideles",
    name: brand.name,
    short_name: brand.shortName,
    description: brand.description,
    lang: "fr-CI",
    start_url: brand.kind === "admin" ? "/?app=semeurs-admin" : "/?app=semeurs-fideles",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: brand.themeColor,
    theme_color: brand.themeColor,
    icons: [
      { src: brand.icons.icon192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: brand.icons.icon512, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: brand.icons.maskable512, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "private, no-store", Vary: "Host" },
  });
}
