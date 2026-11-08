"use client";

import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const MAX = 1080; // pixels de large : net sur téléphone, léger en 3G

/** Allège l'affiche dans le téléphone avant l'envoi (largeur 1080 au plus, JPEG). */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const ratio = Math.min(1, MAX / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * ratio);
  canvas.height = Math.round(bitmap.height * ratio);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("image"))), "image/jpeg", 0.85));
}

/**
 * Affiche de l'événement (facultative) : choisie dans la galerie ou prise en photo, envoyée tout de
 * suite ; son chemin part avec le formulaire dans le champ caché `name` (poster_path par défaut).
 */
export function PosterPicker({ name = "poster_path", label = "Affiche (facultatif)" }: { name?: string; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");

  async function onPick(file: File | undefined) {
    if (!file) return;
    setState("sending");
    try {
      const blob = await shrink(file);
      const name = `${crypto.randomUUID()}.jpg`;
      const { error } = await createClient().storage.from("affiches").upload(name, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      setPath(name);
      setPreview(URL.createObjectURL(blob));
      setState("idle");
    } catch {
      setState("error");
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-bold text-night">{label}</span>
      <input type="hidden" name={name} value={path} />
      <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => onPick(e.target.files?.[0])} />
      {preview ? (
        <div className="relative overflow-hidden rounded-2xl border-2 border-[#c9daf6]">
          {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:) */}
          <img src={preview} alt="Aperçu de l'affiche" className="max-h-64 w-full object-cover" />
          <button
            type="button"
            onClick={() => {
              setPath("");
              setPreview(null);
            }}
            className="absolute right-2 top-2 grid size-11 place-items-center rounded-full bg-white/90 text-alert-text shadow-card"
            aria-label="Retirer l'affiche"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={state === "sending"}
          className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-[#9fbdf0] bg-[#f4f8ff] text-sm font-semibold text-royal disabled:opacity-60"
        >
          <ImagePlus aria-hidden className="size-7" />
          {state === "sending" ? "Envoi de l'affiche…" : "Ajouter une affiche ou une photo"}
        </button>
      )}
      {state === "error" && <p className="text-sm text-alert-text">L&apos;affiche n&apos;a pas pu être envoyée. Réessayez.</p>}
    </div>
  );
}
