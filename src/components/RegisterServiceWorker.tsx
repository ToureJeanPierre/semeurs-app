"use client";

import { useEffect } from "react";

/** Enregistre le service worker (installation de l'appli, page hors connexion). */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Sans service worker l'appli fonctionne quand même, simplement sans mode hors connexion.
    });
  }, []);
  return null;
}
