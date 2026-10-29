"use client";

import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { removePushSubscription, savePushSubscription } from "@/app/actions/push";

type State = "unsupported" | "denied" | "off" | "on" | "loading";
const DISMISS_KEY = "semeurs-push-banner-dismissed";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/**
 * « Recevoir les notifications sur ce téléphone » : réunions, rappels, messages de l'église
 * arrivent même appli fermée. `banner` : invitation discrète sur l'accueil (une seule fois).
 */
export function PushToggle({ banner = false }: { banner?: boolean }) {
  const [state, setState] = useState<State>("loading");
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!key || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      queueMicrotask(() => setState("unsupported"));
      return;
    }
    if (Notification.permission === "denied") {
      queueMicrotask(() => setState("denied"));
      return;
    }
    currentSubscription()
      .then((s) => setState(s ? "on" : "off"))
      .catch(() => setState("unsupported"));
    try {
      if (banner && localStorage.getItem(DISMISS_KEY)) queueMicrotask(() => setHidden(true));
    } catch {
      /* stockage indisponible : la bannière reste visible */
    }
  }, [banner]);

  async function enable() {
    setState("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) }));
      const ok = await savePushSubscription(JSON.parse(JSON.stringify(sub)), navigator.userAgent);
      setState(ok ? "on" : "off");
    } catch {
      setState("off");
    }
  }

  async function disable() {
    setState("loading");
    const sub = await currentSubscription();
    if (sub) {
      await removePushSubscription(sub.endpoint);
      await sub.unsubscribe();
    }
    setState("off");
  }

  if (banner) {
    if (hidden || state !== "off") return null;
    return (
      <div className="flex items-center gap-3 rounded-card bg-royal/5 p-3">
        <BellRing aria-hidden className="size-6 shrink-0 text-royal" />
        <button type="button" onClick={enable} className="flex-1 text-left text-sm font-semibold text-royal">
          Recevoir les notifications sur ce téléphone (réunions, rappels, messages)
        </button>
        <button
          type="button"
          aria-label="Plus tard"
          onClick={() => {
            setHidden(true);
            try {
              localStorage.setItem(DISMISS_KEY, "1");
            } catch {
              /* sans conséquence */
            }
          }}
          className="grid size-11 place-items-center rounded-full text-muted"
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted">
        {state === "on" && "Activées sur ce téléphone : vous êtes prévenu(e) même appli fermée."}
        {state === "off" && "Désactivées sur ce téléphone."}
        {state === "denied" && "Bloquées par le téléphone : autorisez-les dans les réglages du navigateur (Notifications), puis revenez ici."}
        {state === "unsupported" && "Ce téléphone ou ce navigateur ne permet pas les notifications. Installez l'appli depuis Chrome."}
        {state === "loading" && "…"}
      </p>
      {(state === "off" || state === "on") && (
        <button
          type="button"
          onClick={state === "on" ? disable : enable}
          className={`min-h-12 rounded-full font-semibold ${state === "on" ? "bg-cloud text-muted" : "bg-royal text-white"}`}
        >
          {state === "on" ? "Ne plus recevoir sur ce téléphone" : "Recevoir les notifications sur ce téléphone"}
        </button>
      )}
    </div>
  );
}
