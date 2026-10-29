-- Discussion de groupe : réservée aux membres. Un droit d'église (administrateur) ne suffit
-- pas pour lire les conversations des familles ; la modération revient au bureau du groupe.
drop policy "Lire la discussion du groupe" on public.group_messages;
drop policy "Retirer un message" on public.group_messages;

create policy "Lire la discussion du groupe" on public.group_messages for select to authenticated
  using ((select private.is_group_member(group_id)));
create policy "Retirer un message" on public.group_messages for update to authenticated
  using (
    author_id = (select private.current_person_id())
    or (private.is_group_member(group_id) and group_id in (select private.groups_with_permission('groups.manage')))
  )
  with check (
    author_id = (select private.current_person_id())
    or (private.is_group_member(group_id) and group_id in (select private.groups_with_permission('groups.manage')))
  );
