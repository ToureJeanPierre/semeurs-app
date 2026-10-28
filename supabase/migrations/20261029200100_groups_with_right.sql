-- Groupes dans lesquels la personne connectée détient un droit donné (fonction, rôle de
-- groupe ou rôle d'église). Sert aux listes « pour quel groupe ? » (cotisation, réunion…).
create or replace function public.my_groups_with(p_permission text)
returns table (id uuid, name text, type_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.name, gt.name
  from public.groups g
  join public.group_types gt on gt.id = g.type_id
  where g.deleted_at is null and g.active
    and private.has_permission(p_permission, g.id)
  order by gt.position, g.name;
$$;

revoke all on function public.my_groups_with(text) from public, anon;
grant execute on function public.my_groups_with(text) to authenticated;
