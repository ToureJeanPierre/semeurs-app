/**
 * Adresse de la salle Jitsi avec les réglages qui évitent toute étape inutile :
 * pas de proposition d'installer l'appli, pas d'écran d'attente, nom déjà rempli.
 */
export function roomUrl(base: string, displayName: string): string {
  const options = [
    "config.disableDeepLinking=true",
    "config.prejoinConfig.enabled=false",
    "config.prejoinPageEnabled=false",
    `userInfo.displayName=${encodeURIComponent(JSON.stringify(displayName))}`,
  ];
  return `${base.split("#")[0]}#${options.join("&")}`;
}
