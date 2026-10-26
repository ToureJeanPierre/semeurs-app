/**
 * Affiché instantanément pendant le chargement d'un écran, entre la barre du
 * haut et celle du bas (qui restent en place) : des blocs qui pulsent doucement.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Chargement" className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-lg animate-pulse flex-col gap-5 px-4 pt-5">
        <div className="h-48 rounded-card bg-royal/10" />
        <div className="h-20 rounded-card bg-line" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="mx-auto size-16 rounded-2xl bg-line" />
          ))}
        </div>
      </div>
    </div>
  );
}
