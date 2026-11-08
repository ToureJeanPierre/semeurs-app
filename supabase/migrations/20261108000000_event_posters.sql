-- Affiche d'un événement (image), montrée en grand dans le carrousel animé de l'accueil
-- (demande de Jean-Pierre du 08/11/2026). Stockage privé, visible des personnes connectées.
alter table public.church_events add column if not exists poster_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('affiches', 'affiches', false, 3145728, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

create policy "Affiches : voir" on storage.objects for select to authenticated using (bucket_id = 'affiches');
create policy "Affiches : déposer" on storage.objects for insert to authenticated
  with check (bucket_id = 'affiches' and (select private.has_permission('events.manage')));
create policy "Affiches : retirer" on storage.objects for delete to authenticated
  using (bucket_id = 'affiches' and (select private.has_permission('events.manage')));
