-- Groupes auxquels la personne connectée peut envoyer un message groupé, et si elle
-- peut écrire à toute l'église. Sert au formulaire « Nouveau message ».
create or replace function public.my_message_targets()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'church', private.has_permission('messages.send'),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'type', gt.name) order by gt.position, g.name)
      from public.groups g join public.group_types gt on gt.id = g.type_id
      where g.deleted_at is null and g.active
        and (private.has_permission('messages.send')
             or g.id in (select private.groups_with_permission('messages.send')))
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.my_message_targets() from public, anon;
grant execute on function public.my_message_targets() to authenticated;
