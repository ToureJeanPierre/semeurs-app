"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Trash2 } from "lucide-react";
import { setPersonPhoto } from "@/app/actions/photo";
import { Avatar } from "@/components/people/Avatar";
import { createClient } from "@/lib/supabase/client";

const SIZE = 400; // pixels : net sur téléphone, léger en 3G (≈ 30 Ko)

/** Recadre au carré (centre) et allège la photo dans le téléphone, avant l'envoi. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("image"))), "image/jpeg", 0.85));
}

/**
 * Ajouter, changer ou retirer une photo de profil. Sur Android, le bouton propose
 * l'appareil photo ou la galerie.
 */
export function PhotoPicker({ personId, name, url, size = 96 }: { personId: string; name: string; url: string | null; size?: number }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onPick(file: File | undefined) {
    if (!file) return;
    setState("sending");
    setMessage("Envoi de la photo…");
    try {
      const blob = await shrink(file);
      const path = `${personId}/${Date.now()}.jpg`;
      const { error } = await createClient().storage.from("photos").upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      const result = await setPersonPhoto(personId, path);
      if (result.error) throw new Error(result.error);
      setState("idle");
      setMessage("Photo enregistrée ✓");
      router.refresh();
    } catch (e) {
      setState("error");
      setMessage(e instanceof Error && e.message.startsWith("Vous") ? e.message : "La photo n'a pas pu être envoyée. Vérifiez la connexion et réessayez.");
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  async function onRemove() {
    setState("sending");
    const result = await setPersonPhoto(personId, null);
    setState(result.error ? "error" : "idle");
    setMessage(result.error ?? "Photo retirée.");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={state === "sending"}
        className="relative rounded-full"
        aria-label={url ? "Changer la photo" : "Ajouter une photo"}
      >
        <Avatar name={name} url={url} size={size} className="bg-royal text-white" />
        <span className="absolute -bottom-1 -right-1 grid size-9 place-items-center rounded-full border-2 border-surface bg-gold text-night shadow-card">
          <Camera aria-hidden className="size-4" />
        </span>
      </button>
      <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => onPick(e.target.files?.[0])} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={state === "sending"}
          className="flex min-h-11 items-center gap-1.5 rounded-full bg-royal/10 px-4 text-sm font-semibold text-royal disabled:opacity-60"
        >
          <Camera aria-hidden className="size-4" /> {url ? "Changer la photo" : "Ajouter une photo"}
        </button>
        {url && (
          <button
            type="button"
            onClick={onRemove}
            disabled={state === "sending"}
            className="grid size-11 place-items-center rounded-full bg-alert-bg text-alert-text disabled:opacity-60"
            aria-label="Retirer la photo"
          >
            <Trash2 aria-hidden className="size-4" />
          </button>
        )}
      </div>
      {message && (
        <p role="status" className={`text-sm ${state === "error" ? "text-alert-text" : "text-muted"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
