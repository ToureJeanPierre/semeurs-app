-- Correctif : variable « phone » ambiguë avec la colonne (révélé par le test RLS).
create or replace function public.add_person_to_group(target_group uuid, p_first_name text, p_last_name text, p_sex text, p_phone text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  person uuid;
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  single boolean;
  other text;
begin
  if not (private.has_permission('people.manage', target_group) or private.has_permission('groups.manage', target_group)) then
    raise exception 'Vous ne pouvez inscrire des personnes que dans un groupe dont vous êtes responsable.' using errcode = '42501';
  end if;
  select gt.single_membership into single from public.groups g join public.group_types gt on gt.id = g.type_id where g.id = target_group;

  if v_phone is not null then
    select p.id into person from public.people p where p.deleted_at is null and (p.phone = v_phone or p.whatsapp = v_phone) limit 1;
  end if;

  if person is not null then
    if exists (select 1 from public.group_memberships where group_id = target_group and person_id = person and end_date is null) then
      raise exception 'Cette personne fait déjà partie du groupe.' using errcode = 'P0001';
    end if;
    if single then
      select g.name into other from public.group_memberships gm join public.groups g on g.id = gm.group_id
      where gm.person_id = person and gm.end_date is null and g.type_id = (select type_id from public.groups where id = target_group)
      limit 1;
      if other is not null then
        raise exception 'Ce numéro appartient à une personne déjà inscrite dans « % ». Demandez à l''administrateur de la changer de groupe.', other
          using errcode = 'P0001';
      end if;
    end if;
  else
    insert into public.people (first_name, last_name, sex, phone, created_by)
    values (trim(p_first_name), trim(p_last_name), p_sex, v_phone, (select auth.uid()))
    returning id into person;
  end if;

  insert into public.group_memberships (group_id, person_id, created_by)
  values (target_group, person, (select auth.uid()));
  return person;
end;
$function$;
