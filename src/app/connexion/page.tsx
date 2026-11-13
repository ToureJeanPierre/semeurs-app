import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { Reveal } from "@/components/ui/Reveal";
import { getBrand } from "@/lib/brand";

export const metadata: Metadata = { title: "Connexion" };

/**
 * Connexion simple, comme dans toutes les applications (Jean-Pierre, 13/11/2026) : rien en tête,
 * ni image ni description. L'écran de lancement bleu (balayage lumineux et logo) s'affiche avant.
 */
export default async function LoginPage() {
  const brand = await getBrand();
  return (
    <main className="flex flex-1 items-center justify-center bg-[linear-gradient(180deg,#eef5ff_0%,#f7faff_60%,#ffffff_100%)] px-4 py-10">
      <Reveal className="w-full max-w-md">
        <section className="rounded-[1.75rem] bg-surface p-6 shadow-[0_24px_60px_-20px_rgb(11_42_111/0.35)] ring-1 ring-[#dbe7fb]">
          <h1 className="mb-6 text-center font-display text-2xl font-extrabold text-night">
            {brand.kind === "admin" ? "Connexion · Administration" : "Connexion"}
          </h1>
          <LoginForm />
        </section>
      </Reveal>
    </main>
  );
}
