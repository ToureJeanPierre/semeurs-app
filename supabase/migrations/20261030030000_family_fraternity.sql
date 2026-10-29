-- Fraternité dans les familles (demande de Jean-Pierre, 29/10/2026) : les membres d'une
-- famille peuvent se joindre, souhaiter la bienvenue aux nouveaux et les anniversaires.
-- Chacun peut masquer son numéro (people.hide_phone) ; le bureau (père, mère…) reste joignable.

alter table public.people add column hide_phone boolean not null default false;

insert into public.message_templates (code, label, body) values
  ('family_welcome', 'Bienvenue dans la famille',
   'Bienvenue {prénom} dans la famille ! Nous sommes heureux de t''accueillir parmi nous. Que Dieu te bénisse.')
on conflict (code) do nothing;

-- Le fidèle choisit lui-même de montrer ou non son numéro aux membres de sa famille.
create or replace function public.set_my_phone_visibility(p_hidden boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.people set hide_phone = p_hidden where id = private.current_person_id();
$$;

revoke all on function public.set_my_phone_visibility(boolean) from public, anon;
grant execute on function public.set_my_phone_visibility(boolean) to authenticated;

-- Ma famille, vue du membre : noms, numéros (sauf masqués ; le bureau reste joignable),
-- jour et mois d'anniversaire (sans l'année), date d'arrivée dans la famille.
create or replace function public.my_family()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', g.id,
    'name', g.name,
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id,
        'first_name', p.first_name,
        'name', upper(p.last_name) || ' ' || p.first_name,
        'function', f.label,
        'phone', case when f.id is not null or not p.hide_phone then coalesce(p.whatsapp, p.phone) end,
        'birthday', to_char(p.birth_date, 'MM-DD'),
        'joined_on', x.start_date,
        'is_me', p.id = private.current_person_id()
      ) order by f.rank nulls last, p.last_name, p.first_name), '[]'::jsonb)
      from public.group_memberships x
      join public.people p on p.id = x.person_id and p.deleted_at is null
      left join public.group_functions f on f.id = x.function_id
      where x.group_id = g.id and x.end_date is null
    )
  )
  from public.group_memberships gm
  join public.groups g on g.id = gm.group_id and g.deleted_at is null
  join public.group_types gt on gt.id = g.type_id and gt.slug = 'family'
  where gm.person_id = private.current_person_id() and gm.end_date is null
  limit 1;
$$;

-- Un nouveau membre rejoint une famille : tous les autres membres sont invités à l'accueillir.
create or replace function private.notify_family_newcomer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  who text;
  fam text;
begin
  if not exists (select 1 from public.groups g join public.group_types gt on gt.id = g.type_id
                 where g.id = new.group_id and gt.slug = 'family') then
    return new;
  end if;
  select first_name || ' ' || last_name into who from public.people where id = new.person_id;
  select name into fam from public.groups where id = new.group_id;
  insert into public.notifications (person_id, title, body, link, kind)
  select gm.person_id, 'Accueillons ' || who || ' !',
         who || ' rejoint ' || fam || '. Un mot de bienvenue lui fera du bien.', '/famille', 'family'
  from public.group_memberships gm
  where gm.group_id = new.group_id and gm.end_date is null and gm.person_id <> new.person_id;
  return new;
end;
$$;

create trigger group_memberships_newcomer after insert on public.group_memberships
  for each row execute function private.notify_family_newcomer();
