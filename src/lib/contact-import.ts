import { formatPhone, parseIvorianPhone } from "./phone";

export type ImportedContact = {
  lastName: string;
  firstName: string;
  /** Numéro ivoirien au format affiché, ex. « 07 08 31 04 33 » (sans +225). */
  phone: string | null;
  /** Vrai si le contact avait des numéros, mais aucun ivoirien valide. */
  phoneRejected: boolean;
};

/**
 * Transforme un contact du répertoire (API Contact Picker) en champs de fiche.
 * Le premier mot devient le nom, le reste le(s) prénom(s) : c'est l'usage le plus
 * courant ici (« KOUASSI Jean »). Un bouton permet d'inverser si besoin.
 */
export function importContact(names: string[] = [], tels: string[] = []): ImportedContact {
  const words = (names.find((n) => n.trim()) ?? "").trim().split(/\s+/).filter(Boolean);
  const [lastName = "", ...rest] = words;
  const valid = tels.map((t) => parseIvorianPhone(t)).find((p) => p !== null) ?? null;
  return {
    lastName,
    firstName: rest.join(" "),
    phone: valid ? formatPhone(valid) : null,
    phoneRejected: tels.length > 0 && !valid,
  };
}
