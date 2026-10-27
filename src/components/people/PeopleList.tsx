"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";

export type PeopleRow = {
  id: string;
  name: string;
  detail: string;
  family: string | null;
  status: string;
};

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** Registre avec recherche instantanée et filtre « sans famille ». */
export function PeopleList({ rows }: { rows: PeopleRow[] }) {
  const [query, setQuery] = useState("");
  const [onlyUnattached, setOnlyUnattached] = useState(false);
  const unattachedCount = rows.filter((r) => !r.family).length;

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return rows.filter(
      (r) => (!onlyUnattached || !r.family) && (!q || normalize(`${r.name} ${r.detail} ${r.family ?? ""}`).includes(q)),
    );
  }, [rows, query, onlyUnattached]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-13 items-center rounded-2xl border-2 border-line bg-surface px-3 focus-within:border-ink/40">
        <Search aria-hidden className="mr-2 size-5 shrink-0 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nom, téléphone, quartier, famille…"
          aria-label="Rechercher une personne"
          className="w-full bg-transparent py-3 text-base outline-none placeholder:text-muted/60"
        />
      </div>
      <div className="flex gap-2" role="group" aria-label="Filtre">
        {[
          [false, `Tous (${rows.length})`],
          [true, `Sans famille (${unattachedCount})`],
        ].map(([value, label]) => (
          <button
            key={String(value)}
            type="button"
            aria-pressed={onlyUnattached === value}
            onClick={() => setOnlyUnattached(value as boolean)}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold ${
              onlyUnattached === value ? "bg-royal text-white" : "bg-surface text-ink shadow-card"
            }`}
          >
            {label as string}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="rounded-card bg-surface p-4 text-sm text-muted">Personne ne correspond.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-card bg-surface shadow-card">
          {visible.map((r) => (
            <li key={r.id}>
              <Link href={`/fideles/${r.id}`} className="flex min-h-16 items-center gap-3 px-3 py-2">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-royal/10 font-display font-semibold text-night">
                  {initials(r.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{r.name}</span>
                  <span className="block truncate text-sm text-muted">
                    {r.family ?? "Sans famille"}
                    {r.detail ? ` · ${r.detail}` : ""}
                  </span>
                </span>
                <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
