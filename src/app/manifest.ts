import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Les Semeurs de la Parole",
    short_name: "Les Semeurs",
    description: "Suivi des fidèles, familles, équipes et vie de l'église.",
    lang: "fr-CI",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Couleur de l'écran d'ouverture affiché par Android : le même bleu que notre lancement.
    background_color: "#1546B8",
    theme_color: "#1546B8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
