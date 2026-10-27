"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  backAction,
  doneAction,
  initialState,
  isBackTo,
  isTransient,
  onPop,
  onPush,
  onReplace,
  type NavState,
} from "@/lib/nav-trail";

/**
 * Branche le fil d'Ariane (lib/nav-trail.ts) sur le navigateur. Le fil est gardé
 * dans la session de l'onglet : il repart de zéro à chaque ouverture de l'appli.
 */
const STATE_KEY = "semeurs:nav";
const PENDING_KEY = "semeurs:nav:pending";
const OPEN_MENU_KEY = "semeurs:nav:open-menu";

type Pending = { kind: "pop"; steps: number } | { kind: "menu" } | { kind: "tab" } | { kind: "replace" };

function read<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Stockage indisponible (navigation privée) : la flèche remontera à l'écran parent.
  }
}

/** Le prochain écran est ouvert depuis le menu (trois traits). */
export function markMenuNavigation() {
  write(PENDING_KEY, { kind: "menu" } satisfies Pending);
}

/** Le prochain écran est ouvert depuis la barre du bas : toujours une nouvelle étape. */
export function markTabNavigation() {
  write(PENDING_KEY, { kind: "tab" } satisfies Pending);
}

/** Événement envoyé quand le menu doit se rouvrir à l'arrivée sur un écran. */
export const OPEN_MENU_EVENT = "semeurs:open-menu";

/** À placer une fois dans le cadre de l'appli : suit chaque changement d'écran. */
export function NavTrailTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const pending = read<Pending>(PENDING_KEY);
    write(PENDING_KEY, null);
    const state = read<NavState>(STATE_KEY);
    let next: NavState;
    if (!state) next = initialState(pathname);
    else if (pending?.kind === "pop") next = onPop(state, pathname, pending.steps);
    else if (pending?.kind === "replace") next = onReplace(state, pathname);
    else if (!pending && isBackTo(state, pathname)) {
      // Bouton Retour du téléphone : on arrive sur l'écran précédent du fil.
      if (state.entries[state.depth]?.viaMenu) write(OPEN_MENU_KEY, true);
      next = onPop(state, pathname, 1);
    } else next = onPush(state, pathname, pending?.kind === "menu");
    write(STATE_KEY, next);

    if (read<boolean>(OPEN_MENU_KEY)) {
      write(OPEN_MENU_KEY, null);
      window.dispatchEvent(new Event(OPEN_MENU_EVENT));
    }

    // Revenu sur un formulaire de création déjà envoyé : on continue de reculer.
    if (next.depth < (state?.depth ?? 0) && isTransient(pathname) && next.depth > 0) {
      write(PENDING_KEY, { kind: "pop", steps: 1 } satisfies Pending);
      window.history.back();
    }
  }, [pathname]);

  return null;
}

/** Flèche Retour et bouton « Terminer ». */
export function useNavTrail() {
  const router = useRouter();
  const pathname = usePathname();

  const back = useCallback(() => {
    const action = backAction(read<NavState>(STATE_KEY) ?? initialState(pathname), pathname);
    if (action.kind === "history") {
      if (action.openMenu) write(OPEN_MENU_KEY, true);
      write(PENDING_KEY, { kind: "pop", steps: 1 } satisfies Pending);
      window.history.back();
    } else {
      write(PENDING_KEY, { kind: "replace" } satisfies Pending);
      router.replace(action.to);
    }
  }, [pathname, router]);

  const done = useCallback(
    (href: string) => {
      const action = doneAction(read<NavState>(STATE_KEY) ?? initialState(pathname), href);
      if (action.kind === "history") {
        write(PENDING_KEY, { kind: "pop", steps: action.steps } satisfies Pending);
        window.history.go(-action.steps);
      } else if (action.kind === "push") {
        router.push(action.to);
      }
    },
    [pathname, router],
  );

  return { back, done };
}
