import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Le contenu dépend presque toujours de la personne connectée :
  // on reste sur le rendu dynamique classique (sans Cache Components).
  experimental: {
    // Un écran déjà vu ou préchargé est réaffiché sans attendre le serveur
    // pendant 60 s (navigation instantanée entre les onglets).
    staleTimes: { dynamic: 60, static: 300 },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
