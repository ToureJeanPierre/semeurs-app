"use client";

import { useEffect } from "react";

/** Ouvre le volet dépliable visé par l'adresse (#…) quand on touche un raccourci de la page. */
export function HashOpener() {
  useEffect(() => {
    const open = () => {
      const el = window.location.hash ? document.getElementById(window.location.hash.slice(1)) : null;
      if (el instanceof HTMLDetailsElement) {
        el.open = true;
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  return null;
}
