-- Les responsables des âmes (souls.manage) peuvent aussi supprimer une nouvelle âme
-- (demande de Jean-Pierre du 30/10/2026). Même archivage : rien n'est effacé.
create or replace function public.archive_person(p_person uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (private.has_permission('people.manage')
          or (private.has_permission('souls.manage') and private.follows_soul(p_person))) then
    raise exception 'Réservé aux personnes qui gèrent les fiches de l''église.' using errcode = '42501';
  end if;
  if p_person = private.current_person_id() then
    raise exception 'Vous ne pouvez pas supprimer votre propre fiche.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Indiquez le motif.' using errcode = 'P0001';
  end if;
  update public.people set deleted_at = now() where id = p_person and deleted_at is null;
  update public.group_memberships set end_date = current_date, function_id = null where person_id = p_person and end_date is null;
  update public.role_assignments set end_date = current_date where person_id = p_person and end_date is null;
  update public.soul_assignments set end_date = current_date where (person_id = p_person or assignee_id = p_person) and end_date is null;
  delete from public.users where person_id = p_person;
  -- Le motif reste dans le journal de suivi de la fiche (lisible si la fiche est restaurée).
  insert into public.follow_ups (person_id, author_id, channel, result, note)
  values (p_person, private.current_person_id(), 'other', 'archived', 'Fiche supprimée : ' || trim(p_reason));
end;
$$;
