import Image from "next/image";

export function Logo({ size = 120, priority = false }: { size?: number; priority?: boolean }) {
  return (
    <Image
      src="/logo-semeurs.webp"
      alt="Logo de l'Église évangélique Les Semeurs de la Parole"
      width={size}
      height={size}
      priority={priority}
      className="rounded-full"
    />
  );
}
