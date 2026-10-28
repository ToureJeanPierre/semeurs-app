import { formatMoney } from "@/lib/format";

/** Montant collecté et, s'il y a un objectif, la barre d'avancement. */
export function ProgressBar({ total, target }: { total: number; target: number | null }) {
  const pct = target ? Math.max(0, Math.min(100, Math.round((total / target) * 100))) : null;
  return (
    <div className="flex flex-col gap-1">
      <p className="flex items-baseline justify-between gap-2">
        <span className="font-display text-xl font-bold text-royal">{formatMoney(total)}</span>
        {target && <span className="text-sm text-muted">sur {formatMoney(target)}</span>}
      </p>
      {pct !== null && (
        <div className="h-2.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avancement">
          <div className="h-full rounded-full bg-gradient-to-r from-gold to-warm" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}
