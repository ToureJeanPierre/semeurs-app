import type { Metadata, Viewport } from "next";
import { Comfortaa, Dancing_Script, Figtree, Outfit } from "next/font/google";
import { BrandProvider } from "@/components/BrandProvider";
import { MotionProvider } from "@/components/MotionProvider";
import { getBrand } from "@/lib/brand";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";
import { SplashScreen } from "@/components/SplashScreen";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Écriture manuscrite, réservée à la phrase de la bannière (maquette du 26/10/2026)
const script = Dancing_Script({
  variable: "--font-dancing",
  subsets: ["latin"],
  weight: ["600", "700"],
});

// Lettres rondes du titre « Jésus-Christ » (style de l'affiche d'évangélisation)
const rounded = Comfortaa({
  variable: "--font-comfortaa",
  subsets: ["latin"],
  weight: ["700"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["600", "800"],
});

/** Nom, icônes et couleur selon l'application ouverte (fidèles ou administration). */
export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand();
  return {
    title: { default: brand.name, template: `%s · ${brand.shortName}` },
    description: brand.description,
    applicationName: brand.shortName,
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: brand.shortName, statusBarStyle: "default" },
    icons: {
      icon: [
        { url: brand.icons.favicon, sizes: "48x48", type: "image/png" },
        { url: brand.icons.icon192, sizes: "192x192", type: "image/png" },
        { url: brand.icons.icon512, sizes: "512x512", type: "image/png" },
      ],
      apple: brand.icons.apple,
    },
    formatDetection: { telephone: false },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const brand = await getBrand();
  return { themeColor: brand.themeColor, width: "device-width", initialScale: 1 };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const brand = await getBrand();
  return (
    <html
      lang="fr-CI"
      className={`${figtree.variable} ${outfit.variable} ${script.variable} ${rounded.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SplashScreen logo={brand.logo} name={brand.kind === "admin" ? "Administration" : brand.name} />
        <BrandProvider brand={brand}>
          <MotionProvider>{children}</MotionProvider>
        </BrandProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
