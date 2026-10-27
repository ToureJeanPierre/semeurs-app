"use client";

import { HomeLocator } from "./HomeLocator";

/** Page publique : envoie la position avec le jeton du lien. */
export function PublicLocator({ token }: { token: string }) {
  async function save(input: { lat: number; lng: number; accuracy?: number }) {
    try {
      const res = await fetch("/api/position", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...input }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      return data.ok ? { success: "Merci ! Votre position est enregistrée. Vous pouvez fermer cette page." } : { error: data.error ?? "Échec de l'envoi." };
    } catch {
      return { error: "Pas de réseau. Réessayez dans un instant." };
    }
  }
  return <HomeLocator save={save} label="Partager ma position" />;
}
