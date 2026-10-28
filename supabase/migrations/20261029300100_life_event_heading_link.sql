-- Le lien « cotisation de soutien ouverte pour cet événement » est porté par la cotisation :
-- la trésorière, qui crée la cotisation, n'a pas à modifier l'événement de vie.
alter table public.contribution_headings
  add column life_event_id uuid references public.life_events (id) on delete set null;
create index contribution_headings_life_event_idx on public.contribution_headings (life_event_id) where life_event_id is not null;

alter table public.life_events drop column heading_id;
grant update (status, note) on public.life_events to authenticated;
