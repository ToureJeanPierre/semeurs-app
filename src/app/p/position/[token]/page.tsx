import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { PublicLocator } from "@/components/location/PublicLocator";

export const metadata: Metadata = { title: "Partager ma position", robots: { index: false } };

/** Lien public envoyé par WhatsApp à un fidèle sans compte (aucune donnée affichée). */
export default async function PublicPositionPage({ params }: PageProps<"/p/position/[token]">) {
  const { token } = await params;
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <Logo size={88} priority />
      <div>
        <h1 className="text-2xl font-extrabold">Les Semeurs de la Parole</h1>
        <p className="mt-2 text-muted">
          Quand vous êtes chez vous, touchez le bouton ci-dessous. Votre position ne sera vue que par votre père de
          famille, votre délégué et le pasteur.
        </p>
      </div>
      <PublicLocator token={token} />
    </main>
  );
}
