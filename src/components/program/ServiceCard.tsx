import type { ReactNode } from "react";
import { BookOpen, MapPin } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatHour, formatLongDay, formatShortDay } from "@/lib/format";
import type { ProgramService } from "@/lib/program";

/** Un culte du programme : date, heure, lieu, et qui tient chaque poste. */
export function ServiceCard({
  service,
  highlight,
  children,
  renderPosition,
  anchorId,
}: {
  anchorId?: string;
  service: ProgramService;
  /** Personne à mettre en avant (soi-même). */
  highlight?: string | null;
  children?: ReactNode;
  /** Remplace l'affichage d'un poste (écran de préparation). */
  renderPosition?: (p: ProgramService["positions"][number]) => ReactNode;
}) {
  const filled = service.positions.filter((p) => p.personId || renderPosition);
  return (
    <Card id={anchorId} className="relative flex scroll-mt-20 flex-col gap-3 overflow-hidden shadow-card">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gold" />
      <div className="flex items-start gap-3">
        <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-royal to-night text-center text-white shadow-float">
          <span className="text-xl font-extrabold leading-none">{Number(service.service_date.slice(8, 10))}</span>
          <span className="-mt-2 text-[11px] font-semibold uppercase">
            {formatShortDay(service.service_date).split(" ")[2]?.replace(".", "")}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-bold leading-tight text-night">{service.title}</h3>
          <p className="text-sm text-muted first-letter:uppercase">
            {formatLongDay(service.service_date)} · {formatHour(service.starts_at)}
            {!service.published && <span className="ml-2 rounded-full bg-warm/20 px-2 py-0.5 text-xs font-semibold text-night">Brouillon</span>}
            {service.exceptional && <span className="ml-2 rounded-full bg-gold/30 px-2 py-0.5 text-xs font-semibold text-night">Exceptionnel</span>}
          </p>
          {service.place && (
            <p className="flex items-center gap-1 text-sm text-muted">
              <MapPin aria-hidden className="size-4" /> {service.place}
            </p>
          )}
        </div>
      </div>
      {filled.length > 0 && (
        <ul className="flex flex-col divide-y divide-line">
          {filled.map((p) =>
            renderPosition ? (
              <li key={p.id} className="py-2">
                {renderPosition(p)}
              </li>
            ) : (
              <li key={p.id} className={`flex flex-col py-2 ${p.personId === highlight ? "rounded-xl bg-gold/15 px-2" : ""}`}>
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-muted">{p.position}</span>
                  <span className="text-right font-semibold">{p.personName}</span>
                </span>
                {(p.theme || p.bibleText) && (
                  <span className="mt-1 flex items-start gap-1.5 text-sm text-royal">
                    <BookOpen aria-hidden className="mt-0.5 size-4 shrink-0" />
                    <span>
                      {p.theme && <span className="font-semibold">« {p.theme} »</span>}
                      {p.theme && p.bibleText && " · "}
                      {p.bibleText}
                    </span>
                  </span>
                )}
              </li>
            ),
          )}
        </ul>
      )}
      {children}
    </Card>
  );
}
