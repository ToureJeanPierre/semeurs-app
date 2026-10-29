/** Avancement en leçons (et non en francs). */
export function LessonBar({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="font-semibold text-royal">
        {done} / {total} leçon{total > 1 ? "s" : ""} validée{done > 1 ? "s" : ""}
      </span>
      <span className="h-2 overflow-hidden rounded-full bg-cloud" aria-hidden>
        <span className="block h-full rounded-full bg-royal" style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}
