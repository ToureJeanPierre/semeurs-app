"use client";

import { useId, useMemo, useState } from "react";
import { Search, UserRound, X } from "lucide-react";

export type PersonOption = { id: string; name: string; detail?: string | null };

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Choix d'une personne dans la liste des membres (jamais de saisie libre :
 * docs/01 §4). Recherche sans accents ; la valeur part dans un champ caché `name`.
 */
export function PersonPicker({
  name,
  label,
  people,
  defaultId,
  placeholder = "Rechercher un nom…",
}: {
  name: string;
  label: string;
  people: PersonOption[];
  defaultId?: string | null;
  placeholder?: string;
}) {
  const id = useId();
  const [selected, setSelected] = useState<PersonOption | null>(
    () => people.find((p) => p.id === defaultId) ?? null,
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = normalize(query.trim());
    const list = q ? people.filter((p) => normalize(p.name).includes(q)) : people;
    return list.slice(0, 8);
  }, [people, query]);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <input type="hidden" name={name} value={selected?.id ?? ""} />
      {selected ? (
        <div className="flex min-h-13 items-center gap-3 rounded-2xl border-2 border-royal/30 bg-royal/5 px-3">
          <UserRound aria-hidden className="size-5 shrink-0 text-royal" />
          <span className="min-w-0 flex-1 truncate font-semibold">{selected.name}</span>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setOpen(true);
            }}
            className="grid size-11 place-items-center rounded-full text-muted hover:bg-royal/10"
            aria-label={`Changer : ${selected.name}`}
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="flex min-h-13 items-center rounded-2xl border-2 border-[#c9daf6] bg-[#f4f8ff] px-3 focus-within:border-royal focus-within:bg-white focus-within:ring-4 focus-within:ring-royal/10">
            <Search aria-hidden className="mr-2 size-5 shrink-0 text-muted" />
            <input
              id={id}
              type="search"
              role="combobox"
              aria-expanded={open}
              aria-controls={`${id}-list`}
              autoComplete="off"
              value={query}
              placeholder={placeholder}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              className="w-full bg-transparent py-3 text-base outline-none placeholder:text-muted/60"
            />
          </div>
          {open && (
            <ul
              id={`${id}-list`}
              role="listbox"
              className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-2xl border border-line bg-surface p-1 shadow-float"
            >
              {matches.length === 0 ? (
                <li className="px-3 py-3 text-sm text-muted">
                  Personne ne correspond. Ajoutez d&apos;abord la personne au registre.
                </li>
              ) : (
                matches.map((p) => (
                  <li key={p.id} role="option" aria-selected={false}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(p);
                        setQuery("");
                        setOpen(false);
                      }}
                      className="flex min-h-12 w-full flex-col justify-center rounded-xl px-3 text-left hover:bg-royal/5"
                    >
                      <span className="font-semibold">{p.name}</span>
                      {p.detail && <span className="text-xs text-muted">{p.detail}</span>}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
