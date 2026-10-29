-- Ma famille : la photo de chaque frère et sœur.
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
        'is_me', p.id = private.current_person_id(),
        'photo_path', p.photo_path
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
