-- Menu du simple fidèle raccourci (demande de Jean-Pierre, 29/10/2026) : chacun ne voit
-- que ce qui le concerne. Les réunions et les annonces arrivent par notification.
--   Annonces            → ceux qui peuvent écrire (messages.send)
--   Réunions            → ceux qui en organisent (meetings.manage)
--   Âmes                → évangélisation et responsables du suivi (souls.manage, alerts.manage)
--   Événements de vie   → responsables du suivi ; le fidèle signale depuis « Mon espace »
--   Ma famille          → ouvert à tous les membres d'une famille
update public.modules set required_permissions = '{messages.send}', required_scope = 'any' where code = 'messages';
update public.modules set required_permissions = '{meetings.manage}', required_scope = 'any' where code = 'meetings';
update public.modules set required_permissions = '{souls.manage,alerts.manage}', required_scope = 'any' where code = 'souls';
update public.modules set required_permissions = '{alerts.manage,people.view}', required_scope = 'any' where code = 'life_events';
update public.modules set required_permissions = '{}', required_scope = 'any' where code = 'family';
update public.modules set description = 'Offrandes, dîmes et dons à l''église (bientôt). À ne pas confondre avec les cotisations de famille ou de groupe.'
where code = 'giving';

-- Les membres d'une famille se voient entre eux (choix confirmé par Jean-Pierre).
update public.group_types set members_see_each_other = true where slug = 'family';

-- Ma famille, vue du simple membre : les noms ; le téléphone du seul bureau (père, mère…).
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
        'name', upper(p.last_name) || ' ' || p.first_name,
        'function', f.label,
        'phone', case when f.id is not null then coalesce(p.whatsapp, p.phone) end
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

revoke all on function public.my_family() from public, anon;
grant execute on function public.my_family() to authenticated;
