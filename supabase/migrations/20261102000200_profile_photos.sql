-- Photo de profil (demande de Jean-Pierre du 29/10/2026) : chaque fidèle peut mettre sa photo ;
-- ceux qui gèrent sa fiche aussi. Stockage privé, visible des seules personnes connectées.
alter table public.people add column if not exists photo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 2097152, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

-- Le dossier porte l'identifiant de la personne : « <person_id>/<fichier> ».
create or replace function private.can_edit_photo(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_folder ~ '^[0-9a-f-]{36}$'
    and (p_folder::uuid = private.current_person_id() or private.can_manage_person(p_folder::uuid));
$$;

revoke all on function private.can_edit_photo(text) from public, anon;
grant execute on function private.can_edit_photo(text) to authenticated;

create policy "Photos : voir" on storage.objects for select to authenticated using (bucket_id = 'photos');
create policy "Photos : déposer" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (select private.can_edit_photo((storage.foldername(name))[1])));
create policy "Photos : remplacer" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (select private.can_edit_photo((storage.foldername(name))[1])));
create policy "Photos : retirer" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (select private.can_edit_photo((storage.foldername(name))[1])));

-- Enregistre (ou retire, p_path null) la photo d'une fiche ; renvoie l'ancien chemin pour le ménage.
create or replace function public.set_person_photo(p_person uuid, p_path text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare old text;
begin
  if not private.can_edit_photo(p_person::text) then
    raise exception 'Vous ne pouvez pas changer cette photo.' using errcode = '42501';
  end if;
  if p_path is not null and p_path not like p_person::text || '/%' then
    raise exception 'Fichier invalide.' using errcode = 'P0001';
  end if;
  select photo_path into old from public.people where id = p_person;
  update public.people set photo_path = p_path where id = p_person;
  return old;
end;
$$;

revoke all on function public.set_person_photo(uuid, text) from public, anon;
grant execute on function public.set_person_photo(uuid, text) to authenticated;
