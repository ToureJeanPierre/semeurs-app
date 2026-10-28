-- Lot 2 — Programme des cultes : fonctions complémentaires.
--
-- notify_position_change : prévient la personne à qui l'on confie un passage déjà publié.
-- swap_candidates        : pour une demande d'échange, les membres du vivier du poste
--                          (prénom et nom seulement ; les fiches restent protégées).

create or replace function public.notify_position_change(p_position uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('program.manage') then
    raise exception 'Réservé au chargé du programme.' using errcode = '42501';
  end if;
  insert into public.notifications (person_id, title, body, link, kind)
  select sp.person_id, 'Nouveau passage',
         sp.position || ' · ' || s.title || ' du ' || to_char(s.service_date, 'DD/MM') || ' : ce passage vous est confié.',
         '/mon-espace', 'program'
  from public.service_positions sp
  join public.services s on s.id = sp.service_id
  where sp.id = p_position and sp.person_id is not null and s.published_at is not null;
end;
$$;

revoke all on function public.notify_position_change(uuid) from public, anon;
grant execute on function public.notify_position_change(uuid) to authenticated;

create or replace function public.swap_candidates(p_position uuid)
returns table (person_id uuid, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.last_name || ' ' || p.first_name
  from public.service_positions sp
  join public.speaker_pools pool on pool.position = sp.position
  join public.people p on p.id = pool.person_id and p.deleted_at is null
  where sp.id = p_position
    and (sp.person_id = private.current_person_id() or private.has_permission('program.manage'))
    and p.id is distinct from sp.person_id
  order by p.last_name, p.first_name;
$$;

revoke all on function public.swap_candidates(uuid) from public, anon;
grant execute on function public.swap_candidates(uuid) to authenticated;
