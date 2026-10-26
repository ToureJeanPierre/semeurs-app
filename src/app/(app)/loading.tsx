/**
 * Affiché instantanément pendant le chargement d'un écran, entre la barre du
 * haut et celle du bas (qui restent en place) : des blocs qui pulsent doucement.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Chargement" className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-lg animate-pulse flex-col gap-4 px-4 pt-5">
        <div className="h-8 w-2/3 rounded-full bg-line" />
        <div className="h-24 rounded-card bg-royal/10" />
        <div className="h-16 rounded-card bg-line" />
        <div className="h-16 rounded-card bg-line" />
        <div className="h-16 rounded-card bg-line" />
      </div>
    </div>
  );
}
