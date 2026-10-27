/**
 * Fil d'Ariane de la navigation (retour de Jean-Pierre du 27/10/2026, « comme Yango ») :
 * la flèche Retour refait, à l'envers et une étape à la fois, le chemin réellement
 * parcouru. Si un écran a été ouvert depuis le menu (trois traits), le retour
 * rouvre ce menu.
 *
 * Le fil suit exactement l'historique du téléphone (une étape = une entrée de
 * l'historique) : la flèche de l'appli et le bouton Retour d'Android font donc la
 * même chose. Quand il n'y a pas d'étape précédente (appli ouverte directement sur
 * un écran), on remonte à l'écran parent au lieu de quitter l'appli.
 *
 * Logique pure (testée) ; le branchement au navigateur est dans components/layout/NavTrail.tsx.
 */
import { parentPath } from "./parent-path";

export type Step = { path: string; viaMenu: boolean };
export type NavState = { depth: number; entries: Step[] };

export type BackAction =
  | { kind: "history"; steps: number; openMenu: boolean }
  | { kind: "replace"; to: string };

export function initialState(path: string): NavState {
  return { depth: 0, entries: [{ path, viaMenu: false }] };
}

/** Nouvel écran ouvert (lien, menu, onglet, redirection après un formulaire). */
export function onPush(state: NavState, path: string, viaMenu: boolean): NavState {
  if (state.entries[state.depth]?.path === path) return state; // même écran (rechargement)
  const depth = state.depth + 1;
  return { depth, entries: [...state.entries.slice(0, depth), { path, viaMenu }] };
}

/** Retour de `steps` entrées dans l'historique (flèche ou bouton du téléphone). */
export function onPop(state: NavState, path: string, steps = 1): NavState {
  const depth = Math.max(0, state.depth - steps);
  if (state.entries[depth]?.path === path) return { ...state, depth };
  // Historique inattendu : on repart de l'écran affiché.
  const entries = state.entries.slice(0, depth);
  entries[depth] = { path, viaMenu: false };
  return { depth, entries };
}

/** Écran remplacé sur place (remontée au parent sans historique). */
export function onReplace(state: NavState, path: string): NavState {
  const entries = state.entries.slice(0, state.depth + 1);
  entries[state.depth] = { path, viaMenu: false };
  return { depth: state.depth, entries };
}

/** Ce que fait la flèche Retour depuis l'écran `path`. */
export function backAction(state: NavState, path: string): BackAction {
  const current = state.entries[state.depth];
  if (state.depth > 0 && current?.path === path) {
    return { kind: "history", steps: 1, openMenu: current.viaMenu };
  }
  return { kind: "replace", to: parentPath(path) };
}

/**
 * « Terminer et revenir à la liste » : si la liste est dans le chemin parcouru,
 * on y revient en remontant l'historique (pas de boucle) ; sinon on l'ouvre.
 */
export function doneAction(state: NavState, href: string): BackAction | { kind: "push"; to: string } {
  for (let k = state.depth - 1; k >= 0; k--) {
    if (state.entries[k]?.path === href) return { kind: "history", steps: state.depth - k, openMenu: false };
  }
  return { kind: "push", to: href };
}

/**
 * Vrai si `path` est l'écran juste avant dans le fil : c'est un retour (bouton
 * Retour du téléphone), et non l'ouverture d'un nouvel écran.
 */
export function isBackTo(state: NavState, path: string): boolean {
  return state.depth > 0 && state.entries[state.depth - 1]?.path === path;
}

/** Formulaire de création déjà envoyé : on ne s'y arrête pas en revenant en arrière. */
export function isTransient(path: string): boolean {
  return path.endsWith("/nouveau");
}
