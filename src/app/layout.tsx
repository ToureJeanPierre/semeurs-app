import type { Metadata, Viewport } from "next";
import { Dancing_Script, Figtree, Outfit } from "next/font/google";
import { MotionProvider } from "@/components/MotionProvider";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";
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
  weight: ["600"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["600", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Les Semeurs de la Parole",
    template: "%s · Les Semeurs",
  },
  description: "Application de l'Église évangélique Les Semeurs de la Parole, Yopougon.",
  applicationName: "Les Semeurs",
  appleWebApp: { capable: true, title: "Les Semeurs", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#1546B8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr-CI" className={`${figtree.variable} ${outfit.variable} ${script.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <MotionProvider>{children}</MotionProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
