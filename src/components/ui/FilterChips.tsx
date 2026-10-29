import Link from "next/link";
import { ModuleIcon } from "@/components/ui/icons";

export type Chip = { href: string; label: string; icon?: string; active: boolean };

/** Filtres en pastilles avec icône (maquette du 29/10) : la pastille active est pleine, soulignée. */
export function FilterChips({ items, label = "Filtre" }: { items: Chip[]; label?: string }) {
  return (
    <nav aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
      {items.map((c) => (
        <Link
          key={c.href}
          href={c.href}
          aria-current={c.active ? "page" : undefined}
          className={`relative flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${
            c.active ? "bg-royal text-white shadow-float" : "bg-surface text-night shadow-card"
          }`}
        >
          {c.icon && <ModuleIcon name={c.icon} className={`size-4 ${c.active ? "" : "text-royal"}`} />}
          {c.label}
          {c.active && <span aria-hidden className="absolute -bottom-2 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-royal/60" />}
        </Link>
      ))}
    </nav>
  );
}
