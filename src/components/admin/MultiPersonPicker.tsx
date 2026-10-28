"use client";

import { useId, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { PersonOption } from "./PersonPicker";

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Choix de plusieurs personnes dans la liste des membres ; chaque choix part dans un champ caché `name`. */
export function MultiPersonPicker({ name, label, people }: { name: string; label: string; people: PersonOption[] }) {
  const id = useId();
  const [selected, setSelected] = useState<PersonOption[]>([]);
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    return people.filter((p) => !selected.some((s) => s.id === p.id) && normalize(p.name).includes(q)).slice(0, 6);
  }, [people, query, selected]);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {selected.map((p) => (
        <input key={p.id} type="hidden" name={name} value={p.id} />
      ))}
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {selected.map((p) => (
            <li key={p.id} className="flex min-h-10 items-center gap-1 rounded-full bg-royal/10 pl-3 text-sm font-semibold text-royal">
              {p.name}
              <button
                type="button"
                onClick={() => setSelected((s) => s.filter((x) => x.id !== p.id))}
                aria-label={`Retirer ${p.name}`}
                className="grid size-10 place-items-center rounded-full"
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <div className="flex min-h-13 items-center rounded-2xl border-2 border-line bg-surface px-3 focus-within:border-ink/40">
          <Search aria-hidden className="mr-2 size-5 shrink-0 text-muted" />
          <input
            id={id}
            type="search"
            autoComplete="off"
            value={query}
            placeholder="Ajouter une personne…"
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent py-3 text-base outline-none placeholder:text-muted/60"
          />
        </div>
        {matches.length > 0 && (
          <ul role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 rounded-2xl border border-line bg-surface p-1 shadow-float">
            {matches.map((p) => (
              <li key={p.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected((s) => [...s, p]);
                    setQuery("");
                  }}
                  className="flex min-h-12 w-full flex-col justify-center rounded-xl px-3 text-left hover:bg-royal/5"
                >
                  <span className="font-semibold">{p.name}</span>
                  {p.detail && <span className="text-xs text-muted">{p.detail}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
