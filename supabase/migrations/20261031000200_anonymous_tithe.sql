-- Dîme anonyme au choix du fidèle (docs/01 §8.2) : il garde la trace de son don, mais le
-- suivi nominatif des dîmes (pasteur) et les listes de la caisse ne montrent pas son nom.
alter table public.cash_operations add column anonymous boolean not null default false;
