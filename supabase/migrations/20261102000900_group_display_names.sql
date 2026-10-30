-- Dans les listes de choix, un groupe est nommé avec son type (« Cellule Camp Militaire… »,
-- « Équipe Évangélisation », « Famille Ruben ») : un nom de lieu seul ne dit rien (Jean-Pierre, 30/10).
create or replace function public.my_groups_with(p_permission text)
returns table (id uuid, name text, type_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id,
         case when lower(translate(g.name, 'ÉÈÊéèê', 'EEEeee')) like lower(translate(gt.name, 'ÉÈÊéèê', 'EEEeee')) || '%'
              then g.name else gt.name || ' ' || g.name end,
         gt.name
  from public.groups g
  join public.group_types gt on gt.id = g.type_id
  where g.deleted_at is null and g.active
    and private.has_permission(p_permission, g.id)
  order by gt.position, g.name;
$$;
