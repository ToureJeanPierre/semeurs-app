import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

/** Ligne cliquable d'une liste d'administration (icône, titre, détail, chevron). */
export function AdminLink({
  href,
  icon,
  title,
  detail,
  accent,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  detail?: ReactNode;
  accent?: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-16 items-center gap-3 rounded-card bg-surface p-3 pr-2 shadow-card active:scale-[0.99]"
    >
      <span
        className="grid size-11 shrink-0 place-items-center rounded-xl text-white"
        style={{ background: accent ?? "var(--color-royal)" }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-ink">{title}</span>
        {detail && <span className="block truncate text-sm text-muted">{detail}</span>}
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
    </Link>
  );
}

export function PageTitle({ title, intro }: { title: string; intro?: ReactNode }) {
  return (
    <div className="mb-4">
      <h1 className="text-2xl font-extrabold">{title}</h1>
      {intro && <p className="mt-1 text-muted">{intro}</p>}
    </div>
  );
}
