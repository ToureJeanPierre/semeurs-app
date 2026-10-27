import { describe, expect, it } from "vitest";
import { backAction, doneAction, initialState, isBackTo, onPop, onPush, onReplace, type NavState } from "@/lib/nav-trail";

/** Simule une suite d'écrans ouverts : [chemin, ouvert depuis le menu ?]. */
function open(start: string, moves: [string, boolean?][]): NavState {
  return moves.reduce((s, [path, viaMenu]) => onPush(s, path, viaMenu ?? false), initialState(start));
}

describe("fil d'Ariane", () => {
  it("revient pas à pas, et rouvre le menu pour l'écran ouvert depuis le menu (comme Yango)", () => {
    let s = open("/", [["/administration", true], ["/administration/groupes"], ["/administration/groupes/f1"]]);

    expect(backAction(s, "/administration/groupes/f1")).toEqual({ kind: "history", steps: 1, openMenu: false });
    s = onPop(s, "/administration/groupes");
    expect(backAction(s, "/administration/groupes")).toEqual({ kind: "history", steps: 1, openMenu: false });
    s = onPop(s, "/administration");
    // Administration avait été ouverte depuis le menu : retour à l'accueil, menu rouvert.
    expect(backAction(s, "/administration")).toEqual({ kind: "history", steps: 1, openMenu: true });
    s = onPop(s, "/");
    expect(s.depth).toBe(0);
  });

  it("ne saute pas : la fiche ouverte depuis « Ma famille » ramène à « Ma famille »", () => {
    let s = open("/", [["/famille", true], ["/fideles/p1"]]);
    expect(backAction(s, "/fideles/p1")).toMatchObject({ kind: "history", steps: 1 });
    s = onPop(s, "/famille");
    expect(s.entries[s.depth].path).toBe("/famille");
  });

  it("« Terminer et revenir à la liste » remonte l'historique jusqu'à la liste, sans boucle", () => {
    const s = open("/", [["/fideles", true], ["/fideles/nouveau"], ["/fideles/p2"]]);
    expect(doneAction(s, "/fideles")).toEqual({ kind: "history", steps: 2, openMenu: false });
  });

  it("« Terminer » ouvre la liste si elle n'est pas dans le chemin", () => {
    const s = open("/", [["/famille", true], ["/fideles/p1"]]);
    expect(doneAction(s, "/fideles")).toEqual({ kind: "push", to: "/fideles" });
  });

  it("sans écran précédent (appli ouverte directement), remonte à l'écran parent au lieu de quitter", () => {
    const s = initialState("/fideles/p1");
    expect(backAction(s, "/fideles/p1")).toEqual({ kind: "replace", to: "/fideles" });
    expect(onReplace(s, "/fideles")).toEqual(initialState("/fideles"));
    expect(backAction(initialState("/profil"), "/profil")).toEqual({ kind: "replace", to: "/" });
  });

  it("un rechargement du même écran ne crée pas d'étape", () => {
    const s = open("/", [["/profil"]]);
    expect(onPush(s, "/profil", false)).toBe(s);
  });

  it("un retour inattendu (historique différent) repart de l'écran affiché", () => {
    const s = onPop(open("/", [["/a"], ["/b"]]), "/z");
    expect(s).toEqual({ depth: 1, entries: [{ path: "/", viaMenu: false }, { path: "/z", viaMenu: false }] });
  });

  it("reconnaît le bouton Retour du téléphone : arrivée sur l'écran juste avant", () => {
    const s = open("/", [["/fideles", true], ["/fideles/p1"]]);
    expect(isBackTo(s, "/fideles")).toBe(true);
    expect(isBackTo(s, "/famille")).toBe(false);
    expect(isBackTo(initialState("/"), "/")).toBe(false);
  });
});
