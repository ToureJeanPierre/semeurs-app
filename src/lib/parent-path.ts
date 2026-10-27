/**
 * Écran « parent » de chaque écran : la flèche Retour y mène toujours.
 * On ne s'appuie pas sur l'historique du téléphone : sans page précédente,
 * Android fermerait l'application (retour de Jean-Pierre du 27/10/2026).
 *
 *   /fideles/123            → /fideles
 *   /fideles/nouveau        → /fideles
 *   /administration/groupes → /administration
 *   /administration         → /
 *   /m/prayer               → /           (pages « Bientôt » : sans liste propre)
 */
export function parentPath(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length <= 1 || parts[0] === "m") return "/";
  return `/${parts.slice(0, -1).join("/")}`;
}
