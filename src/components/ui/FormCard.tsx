import type { ReactNode } from "react";
import { ModuleIcon } from "@/components/ui/icons";

const TONES = {
  royal: {
    box: "border-[#bcd3f7] from-white to-[#eaf3ff]",
    strip: "from-royal via-[#4f8df5] to-sky",
    chip: "bg-gradient-to-b from-royal to-night text-white",
  },
  gold: {
    box: "border-[#f1d58a] from-[#fffdf7] to-[#fff3d1]",
    strip: "from-gold via-[#ffd76a] to-[#f59e0b]",
    chip: "bg-gradient-to-b from-gold to-[#d99a00] text-night",
  },
  green: {
    box: "border-[#a9e2c5] from-white to-[#e4f7ee]",
    strip: "from-[#1f9d63] via-[#34c483] to-[#9be7c4]",
    chip: "bg-gradient-to-b from-[#1f9d63] to-[#13784a] text-white",
  },
} as const;

/**
 * Encadré de saisie bien visible (demande de Jean-Pierre du 30/10) : bordure de couleur,
 * fond dégradé, bandeau coloré en haut et titre avec icône. Pour les formulaires principaux.
 */
export function FormCard({
  title,
  subtitle,
  icon = "sparkles",
  tone = "royal",
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  icon?: string;
  tone?: keyof typeof TONES;
  children: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <section className={`relative overflow-hidden rounded-[1.5rem] border-2 bg-gradient-to-b p-4 pt-5 shadow-card ${t.box}`}>
      <span aria-hidden className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${t.strip}`} />
      <div className="mb-3 flex items-center gap-3">
        <span className={`grid size-11 shrink-0 place-items-center rounded-2xl shadow-float ${t.chip}`}>
          <ModuleIcon name={icon} className="size-5" strokeWidth={2} />
        </span>
        <span className="min-w-0">
          <span className="block font-display text-lg font-bold leading-tight text-night">{title}</span>
          {subtitle && <span className="block text-sm text-ink/70">{subtitle}</span>}
        </span>
      </div>
      {children}
    </section>
  );
}
