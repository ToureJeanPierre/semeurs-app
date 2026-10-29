import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Clock, MapPin, UserRound } from "lucide-react";
import { ModuleIcon } from "@/components/ui/icons";

/** Teintes d'accent (bordure gauche, vignette, pastille) : une par nature d'élément. */
export const TONES = {
  royal: { bar: "bg-royal", soft: "bg-[#e6efff]", badge: "bg-[#e6efff] text-royal" },
  gold: { bar: "bg-gold", soft: "bg-[#fff4d6]", badge: "bg-[#fff1cc] text-[#8a5a00]" },
  violet: { bar: "bg-[#7c4dff]", soft: "bg-[#f0eaff]", badge: "bg-[#efe8ff] text-[#5b34c9]" },
  green: { bar: "bg-[#1f9d63]", soft: "bg-[#e3f6ec]", badge: "bg-[#ddf4e8] text-[#13784a]" },
  teal: { bar: "bg-[#13a3a3]", soft: "bg-[#e0f6f6]", badge: "bg-[#daf3f3] text-[#0c7b7b]" },
  rose: { bar: "bg-[#e5486b]", soft: "bg-[#fde8ee]", badge: "bg-[#fde4ea] text-[#b4234a]" },
} as const;
export type Tone = keyof typeof TONES;

export type Meta = { icon: "clock" | "place" | "person"; text: string };
const META_ICON = { clock: Clock, place: MapPin, person: UserRound };

/**
 * Ligne de liste illustrée (maquette du 29/10) : bordure de couleur, vignette (image ou icône),
 * titre, informations avec icônes, pastille et chevron. Lien si `href`, sinon carte simple
 * (avec `children` pour des actions : s'inscrire, voter…).
 */
export function ListItem({
  title,
  meta = [],
  badge,
  tone = "royal",
  image,
  icon,
  href,
  children,
}: {
  title: ReactNode;
  meta?: Meta[];
  badge?: string;
  tone?: Tone;
  image?: string | null;
  icon?: string;
  href?: string;
  children?: ReactNode;
}) {
  const t = TONES[tone];
  const head = (
    <div className="flex items-start gap-3">
      <span className={`relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl ${t.soft}`}>
        {image ? (
          <Image src={image} alt="" fill sizes="64px" unoptimized className="object-cover" />
        ) : (
          <ModuleIcon name={icon ?? "sparkles"} className="size-7 text-royal" strokeWidth={1.8} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="font-display text-[1.0625rem] font-bold leading-snug text-night">{title}</span>
          {badge && <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${t.badge}`}>{badge}</span>}
        </span>
        {meta.map((m, i) => {
          const Icon = META_ICON[m.icon];
          return (
            <span key={i} className="mt-1 flex items-start gap-1.5 text-sm text-ink/75">
              <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
              <span className="min-w-0">{m.text}</span>
            </span>
          );
        })}
      </span>
      {href && <ChevronRight aria-hidden className="mt-5 size-5 shrink-0 text-muted" />}
    </div>
  );
  const shell = "relative flex flex-col gap-3 overflow-hidden rounded-card bg-surface py-3 pl-4 pr-3 shadow-card";
  const bar = <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${t.bar}`} />;
  return href ? (
    <Link href={href} className={`${shell} transition-transform active:scale-[0.99]`}>
      {bar}
      {head}
      {children}
    </Link>
  ) : (
    <div className={shell}>
      {bar}
      {head}
      {children}
    </div>
  );
}
