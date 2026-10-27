"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { House, MapPin } from "lucide-react";
import type { FormState } from "@/app/actions/auth";
import { FormFeedback } from "@/components/admin/FormFeedback";

type Status = "idle" | "locating" | "saving" | "done";

/**
 * « Je suis à la maison » (docs/03 §3) : ondes radar pendant la localisation,
 * puis l'épingle tombe. La position n'est demandée qu'au toucher du bouton.
 */
export function HomeLocator({
  save,
  savedLabel,
  label = "Je suis à la maison",
}: {
  save: (input: { lat: number; lng: number; accuracy?: number }) => Promise<FormState>;
  savedLabel?: string | null;
  label?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<FormState>();

  function locate() {
    if (!("geolocation" in navigator)) {
      setResult({ error: "Ce téléphone ne permet pas la localisation." });
      return;
    }
    setResult(undefined);
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setStatus("saving");
        const res = await save({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setResult(res);
        setStatus(res?.success ? "done" : "idle");
      },
      (err) => {
        setStatus("idle");
        setResult({
          error:
            err.code === err.PERMISSION_DENIED
              ? "La localisation est refusée. Autorisez-la dans les réglages du téléphone, puis réessayez."
              : "Position introuvable. Sortez près d'une fenêtre ou activez le GPS, puis réessayez.",
        });
      },
      { enableHighAccuracy: true, timeout: 30_000, maximumAge: 0 },
    );
  }

  const busy = status === "locating" || status === "saving";
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="relative grid size-32 place-items-center">
        {busy &&
          [0, 0.5, 1].map((delay) => (
            <motion.span
              key={delay}
              aria-hidden
              className="absolute inset-0 rounded-full border-2 border-royal"
              initial={{ scale: 0.5, opacity: 0.8 }}
              animate={{ scale: 1.3, opacity: 0 }}
              transition={{ duration: 1.5, delay, repeat: Infinity, ease: "easeOut" }}
            />
          ))}
        <span className="relative grid size-20 place-items-center rounded-full bg-royal/10 text-royal">
          <House aria-hidden className="size-10" strokeWidth={1.7} />
          <AnimatePresence>
            {status === "done" && (
              <motion.span
                className="absolute -top-3 text-alert-ring"
                initial={{ y: -40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 14 }}
              >
                <MapPin aria-hidden className="size-9 fill-current text-alert-ring" />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </div>
      {savedLabel && status !== "done" && <p className="text-sm text-muted">{savedLabel}</p>}
      <button
        type="button"
        onClick={locate}
        disabled={busy}
        className="min-h-12 rounded-full bg-royal px-6 font-semibold text-white disabled:opacity-70"
      >
        {status === "locating" ? "Recherche de la position…" : status === "saving" ? "Enregistrement…" : label}
      </button>
      <FormFeedback state={result} />
    </div>
  );
}
