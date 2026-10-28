import Image from "next/image";

/** En-tête officiel des documents imprimables (reçu, bilan) : logo et coordonnées de l'église. */
export function DocumentHeader({ profile }: { profile: { name?: string; address?: string; phones?: string[]; email?: string } }) {
  return (
    <header className="flex items-center gap-3 border-b border-line pb-3">
      <Image src="/logo-semeurs.webp" alt="" width={56} height={56} className="size-14 rounded-full object-cover" />
      <div className="min-w-0 text-sm">
        <p className="font-display text-base font-bold text-night">{profile.name ?? "Les Semeurs de la Parole"}</p>
        {profile.address && <p className="text-muted">{profile.address}</p>}
        {(profile.phones?.length || profile.email) && (
          <p className="text-muted">{[...(profile.phones ?? []), profile.email].filter(Boolean).join(" · ")}</p>
        )}
      </div>
    </header>
  );
}
