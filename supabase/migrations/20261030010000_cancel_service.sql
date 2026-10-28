-- Programme des cultes : un culte peut être retiré même après publication ;
-- les personnes qui y étaient programmées sont prévenues.
create or replace function public.cancel_service(p_service uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare s public.services;
begin
  if not private.has_permission('program.manage') then
    raise exception 'Réservé au chargé du programme.' using errcode = '42501';
  end if;
  select * into s from public.services where id = p_service;
  if s.id is null then
    return;
  end if;
  if s.published_at is not null then
    insert into public.notifications (person_id, title, body, link, kind)
    select distinct sp.person_id, 'Culte retiré du programme',
           s.title || ' du ' || to_char(s.service_date, 'DD/MM') || ' n''aura pas lieu : votre passage (' || lower(sp.position) || ') est annulé.',
           '/cultes', 'program'
    from public.service_positions sp where sp.service_id = s.id and sp.person_id is not null;
  end if;
  delete from public.services where id = p_service;
end;
$$;

revoke all on function public.cancel_service(uuid) from public, anon;
grant execute on function public.cancel_service(uuid) to authenticated;
