"use client";

import Image from "next/image";
import { useBrand } from "@/components/BrandProvider";

/** Logo de l'application ouverte (fidèles ou administration). */
export function Logo({ size = 120, priority = false }: { size?: number; priority?: boolean }) {
  const brand = useBrand();
  return (
    <Image
      src={brand.logo}
      alt="Logo de l'Église évangélique Les Semeurs de la Parole"
      width={size}
      height={size}
      priority={priority}
      className="rounded-full"
    />
  );
}
