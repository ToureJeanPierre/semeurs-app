"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (options: { formats: string[] }) => Detector;

export function canScanQr(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window && Boolean(navigator.mediaDevices?.getUserMedia);
}

/**
 * Scan plein écran des codes QR (caméra arrière). Utilise le détecteur intégré
 * à Chrome sur Android : rien à télécharger. Un même code n'est lu qu'une fois
 * toutes les 3 secondes.
 */
export function QrScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    const recent = new Map<string, number>();
    const Ctor = (window as unknown as { BarcodeDetector: DetectorCtor }).BarcodeDetector;
    const detector = new Ctor({ formats: ["qr_code"] });

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const tick = async () => {
          if (stopped || !video.current) return;
          try {
            for (const { rawValue } of await detector.detect(video.current)) {
              const last = recent.get(rawValue) ?? 0;
              if (Date.now() - last > 3000) {
                recent.set(rawValue, Date.now());
                onCode(rawValue);
              }
            }
          } catch {
            // image pas encore prête : on réessaie
          }
          setTimeout(tick, 250);
        };
        void tick();
      } catch {
        setError("La caméra n'est pas accessible. Autorisez-la dans les réglages du téléphone, ou pointez avec la liste.");
      }
    })();

    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <video ref={video} playsInline muted className="h-full w-full object-cover" />
      <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="size-64 rounded-3xl border-4 border-white/90 shadow-[0_0_0_9999px_rgb(0_0_0/0.45)]" />
      </div>
      <p className="absolute inset-x-0 top-[max(1rem,env(safe-area-inset-top))] px-6 text-center font-semibold text-white">
        Présentez le code QR du fidèle dans le cadre
      </p>
      {error && (
        <p role="alert" className="absolute inset-x-4 top-1/2 rounded-2xl bg-white p-4 text-center text-alert-text">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={onClose}
        className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 flex min-h-14 -translate-x-1/2 items-center gap-2 rounded-full bg-white px-6 font-semibold text-ink"
      >
        <X aria-hidden className="size-5" />
        Fermer la caméra
      </button>
    </div>
  );
}
