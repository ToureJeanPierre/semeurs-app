-- Comment la base se construit (Jean-Pierre, 09/11/2026) : le pasteur et sa femme administrent ;
-- ils désignent les pères de famille et les responsables d'équipe ; ceux-ci inscrivent les membres
-- de leur groupe et choisissent eux-mêmes leurs aides (mère de famille, adjoint, trésorière, secrétaire…).

-- 1. Inscrire dans son groupe : père/mère de famille (people.manage) et responsables d'équipe,
--    de cellule, de Jeunesse (groups.manage). Un numéro déjà connu rattache la personne existante
--    au lieu de créer un doublon ; une personne déjà dans une autre famille n'en est pas retirée.
create or replace function public.add_person_to_group(target_group uuid, p_first_name text, p_last_name text, p_sex text, p_phone text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  person uuid;
  phone text := nullif(trim(coalesce(p_phone, '')), '');
  single boolean;
  other text;
begin
  if not (private.has_permission('people.manage', target_group) or private.has_permission('groups.manage', target_group)) then
    raise exception 'Vous ne pouvez inscrire des personnes que dans un groupe dont vous êtes responsable.' using errcode = '42501';
  end if;
  select gt.single_membership into single from public.groups g join public.group_types gt on gt.id = g.type_id where g.id = target_group;

  if phone is not null then
    select id into person from public.people where deleted_at is null and (phone = p_phone or whatsapp = p_phone) limit 1;
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
    values (trim(p_first_name), trim(p_last_name), p_sex, phone, (select auth.uid()))
    returning id into person;
  end if;

  insert into public.group_memberships (group_id, person_id, created_by)
  values (target_group, person, (select auth.uid()));
  return person;
end;
$function$;

-- 2. Désigner ses aides : un responsable confie, dans son groupe, une fonction de rang inférieur
--    au sien (le père : mère, adjoint, trésorière ; le responsable d'équipe : adjoint, secrétaire…).
--    L'administration (groups.manage d'église) peut tout désigner. p_person null = retirer la fonction.
create or replace function private.my_rank_in(p_group uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select min(f.rank) from public.group_memberships gm join public.group_functions f on f.id = gm.function_id
  where gm.group_id = p_group and gm.person_id = private.current_person_id() and gm.end_date is null
    and (f.permissions && array['people.manage', 'groups.manage']);
$$;

revoke all on function private.my_rank_in(uuid) from public, anon;
grant execute on function private.my_rank_in(uuid) to authenticated;

create or replace function public.set_group_function(p_group uuid, p_function uuid, p_person uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.group_functions;
  church_admin boolean := private.has_permission('groups.manage');
  mine integer := private.my_rank_in(p_group);
begin
  select * into f from public.group_functions where id = p_function;
  if f.id is null or f.type_id <> (select type_id from public.groups where id = p_group) then
    raise exception 'Fonction inconnue pour ce groupe.' using errcode = 'P0001';
  end if;
  if not (church_admin or (mine is not null and f.rank > mine)) then
    raise exception 'Vous ne pouvez désigner que vos aides (fonctions placées sous la vôtre).' using errcode = '42501';
  end if;
  if p_person is not null and not exists (
    select 1 from public.group_memberships where group_id = p_group and person_id = p_person and end_date is null) then
    raise exception 'Choisissez un membre du groupe.' using errcode = 'P0001';
  end if;
  -- L'ancien titulaire garde sa place dans le groupe, sans la fonction.
  update public.group_memberships set function_id = null
  where group_id = p_group and function_id = p_function and end_date is null
    and (p_person is null or person_id <> p_person);
  if p_person is not null then
    update public.group_memberships set function_id = p_function
    where group_id = p_group and person_id = p_person and end_date is null;
  end if;
end;
$$;

revoke all on function public.set_group_function(uuid, uuid, uuid) from public, anon;
grant execute on function public.set_group_function(uuid, uuid, uuid) to authenticated;
