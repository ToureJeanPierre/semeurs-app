-- Lot 1, étape 2 — Fidèles, familles et délégation (docs/01 §6.1 à §6.3, §13).
--
-- - Fiche fidèle complétée (baptême, situation familiale, motif de non-rattachement).
-- - Délégation : le père de famille confie un sous-groupe de sa famille à un délégué,
--   qui ne voit que ces fidèles (et peut les suivre).
-- - Un responsable de groupe ayant « people.manage » dans son groupe peut y inscrire
--   une nouvelle personne (fonction add_person_to_group).
-- - « Mes groupes » : chacun voit ses groupes, leur bureau, et, si le type de groupe
--   le permet (paramètre), les noms des autres membres.
-- - my_access() renvoie aussi les droits obtenus dans les groupes (pour les menus).

-- ===========================================================================
-- Fiche fidèle
-- ===========================================================================
alter table public.people
  add column baptized_at date,
  add column marital_status text,      -- liste de valeurs « marital_status »
  add column unattached_reason text;   -- liste de valeurs « unattached_reason » (sans famille)

insert into public.value_lists (list_code, value, label, position) values
  ('marital_status', 'single', 'Célibataire', 1),
  ('marital_status', 'married', 'Marié(e)', 2),
  ('marital_status', 'widowed', 'Veuf / veuve', 3),
  ('marital_status', 'divorced', 'Divorcé(e)', 4)
on conflict (list_code, value) do nothing;

-- ===========================================================================
-- Types de groupes : les membres se voient-ils entre eux ?
-- ===========================================================================
alter table public.group_types
  add column members_see_each_other boolean not null default false;

comment on column public.group_types.members_see_each_other is
  'Vrai : dans « Mes groupes », un simple membre voit les noms des autres membres (pas leurs coordonnées).';

-- Équipes, cellules et Jeunesse : oui ; familles et classes : non (le père de famille, lui, voit tout).
update public.group_types set members_see_each_other = true where slug in ('team', 'cell', 'youth');

-- ===========================================================================
-- Délégation du suivi
-- ===========================================================================
create table public.delegations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.groups (id) on delete cascade,
  delegate_id uuid not null references public.people (id) on delete cascade,
  label text, -- ex. « Yopougon Niangon »
  start_date date not null default current_date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  check (end_date is null or end_date >= start_date)
);

create index delegations_family_idx on public.delegations (family_id);
create index delegations_delegate_idx on public.delegations (delegate_id) where end_date is null;

create trigger delegations_set_updated_at before update on public.delegations
  for each row execute function public.set_updated_at();

create table public.delegation_members (
  delegation_id uuid not null references public.delegations (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (delegation_id, person_id)
);

create index delegation_members_person_idx on public.delegation_members (person_id);

create trigger delegations_audit after insert or update or delete on public.delegations
  for each row execute function private.audit();
create trigger delegation_members_audit after insert or update or delete on public.delegation_members
  for each row execute function private.audit();

-- Personnes que la personne connectée suit par délégation (délégations en cours).
create or replace function private.delegated_people()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select dm.person_id
  from public.delegations d
  join public.delegation_members dm on dm.delegation_id = d.id
  where d.delegate_id = private.current_person_id()
    and d.start_date <= current_date
    and (d.end_date is null or d.end_date >= current_date);
$$;

-- Visibilité d'une fiche : ajout du délégué (docs/01 §6.3).
create or replace function private.can_see_person(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target = private.current_person_id()
    or private.has_permission('people.view')
    or exists (
      select 1
      from public.group_memberships gm
      where gm.person_id = target
        and gm.end_date is null
        and gm.group_id in (select private.groups_with_permission('people.view'))
    )
    or target in (select private.delegated_people());
$$;

-- Le père de famille (people.manage dans la famille) gère les délégations de sa famille.
alter table public.delegations enable row level security;
alter table public.delegation_members enable row level security;

create policy "Voir les délégations" on public.delegations for select to authenticated
  using (
    delegate_id = (select private.current_person_id())
    or (select private.has_permission('people.view', family_id))
  );
create policy "Gérer les délégations de sa famille" on public.delegations for all to authenticated
  using ((select private.has_permission('people.manage', family_id)))
  with check ((select private.has_permission('people.manage', family_id)));

create policy "Voir les fidèles délégués" on public.delegation_members for select to authenticated
  using (exists (
    select 1 from public.delegations d
    where d.id = delegation_id
      and (d.delegate_id = (select private.current_person_id())
           or (select private.has_permission('people.view', d.family_id)))
  ));
-- On ne confie que des membres actifs de la famille concernée.
create policy "Confier des fidèles de sa famille" on public.delegation_members for all to authenticated
  using (exists (
    select 1 from public.delegations d
    where d.id = delegation_id and (select private.has_permission('people.manage', d.family_id))
  ))
  with check (exists (
    select 1
    from public.delegations d
    join public.group_memberships gm
      on gm.group_id = d.family_id and gm.person_id = delegation_members.person_id and gm.end_date is null
    where d.id = delegation_id and (select private.has_permission('people.manage', d.family_id))
  ));

revoke all on public.delegations, public.delegation_members from anon, authenticated;
grant select, insert, update, delete on public.delegations, public.delegation_members to authenticated;
grant all on public.delegations, public.delegation_members to service_role;

-- ===========================================================================
-- Inscrire une personne dans un groupe qu'on gère (père de famille, responsable)
-- ===========================================================================
create or replace function public.add_person_to_group(
  target_group uuid,
  p_first_name text,
  p_last_name text,
  p_sex text,
  p_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not private.has_permission('people.manage', target_group) then
    raise exception 'Vous ne pouvez inscrire des personnes que dans un groupe dont vous êtes responsable.'
      using errcode = '42501';
  end if;
  insert into public.people (first_name, last_name, sex, phone, created_by)
  values (trim(p_first_name), trim(p_last_name), p_sex, nullif(trim(coalesce(p_phone, '')), ''), (select auth.uid()))
  returning id into new_id;
  insert into public.group_memberships (group_id, person_id, created_by)
  values (target_group, new_id, (select auth.uid()));
  return new_id;
end;
$$;

revoke all on function public.add_person_to_group(uuid, text, text, text, text) from public, anon;
grant execute on function public.add_person_to_group(uuid, text, text, text, text) to authenticated;

-- Vrai si la personne connectée peut gérer cette fiche (sert avant de créer un compte).
create or replace function public.can_manage_person(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_manage_person(target);
$$;

revoke all on function public.can_manage_person(uuid) from public, anon;
grant execute on function public.can_manage_person(uuid) to authenticated;

-- ===========================================================================
-- « Mes groupes »
-- ===========================================================================
-- Groupes de la personne connectée : bureau toujours visible ; noms des autres
-- membres seulement si le type le permet ou si l'on a « people.view » dans le groupe.
create or replace function public.my_groups()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select private.current_person_id() as person_id),
  mine as (
    select g.id, g.name, g.description, coalesce(g.color, gt.color) as color, gt.name as type_name,
           gt.icon, gt.position, gt.members_see_each_other, f.label as my_function
    from public.group_memberships gm
    join me on me.person_id = gm.person_id
    join public.groups g on g.id = gm.group_id and g.deleted_at is null and g.active
    join public.group_types gt on gt.id = g.type_id
    left join public.group_functions f on f.id = gm.function_id
    where gm.end_date is null
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'name', m.name,
    'description', m.description,
    'color', m.color,
    'type_name', m.type_name,
    'icon', m.icon,
    'my_function', m.my_function,
    'member_count', (select count(*) from public.group_memberships x where x.group_id = m.id and x.end_date is null),
    'bureau', (
      select coalesce(jsonb_agg(jsonb_build_object('function', f.label, 'name', p.first_name || ' ' || p.last_name)
                                order by f.rank), '[]'::jsonb)
      from public.group_memberships x
      join public.group_functions f on f.id = x.function_id
      join public.people p on p.id = x.person_id
      where x.group_id = m.id and x.end_date is null
    ),
    'members', case
      when m.members_see_each_other or private.has_permission('people.view', m.id) then (
        select coalesce(jsonb_agg(p.first_name || ' ' || p.last_name order by p.last_name, p.first_name), '[]'::jsonb)
        from public.group_memberships x
        join public.people p on p.id = x.person_id and p.deleted_at is null
        where x.group_id = m.id and x.end_date is null
      )
      else null
    end
  ) order by m.position, m.name), '[]'::jsonb)
  from mine m;
$$;

revoke all on function public.my_groups() from public, anon;
grant execute on function public.my_groups() to authenticated;

-- ===========================================================================
-- Droits pour l'interface : ajout des droits obtenus dans les groupes et par délégation
-- ===========================================================================
create or replace function public.my_access()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select private.current_person_id() as person_id)
  select jsonb_build_object(
    'person_id', (select person_id from me),
    'church_permissions', coalesce((
      select jsonb_agg(distinct p)
      from public.role_assignments ra
      join public.roles r on r.id = ra.role_id
      cross join lateral unnest(r.permissions) as p
      where ra.person_id = (select person_id from me)
        and ra.scope_type = 'church'
        and ra.start_date <= current_date
        and (ra.end_date is null or ra.end_date >= current_date)
    ), '[]'::jsonb),
    'group_permissions', coalesce((
      select jsonb_agg(distinct p)
      from (
        select unnest(f.permissions) as p
        from public.group_memberships gm
        join public.group_functions f on f.id = gm.function_id
        where gm.person_id = (select person_id from me) and gm.end_date is null
        union
        select unnest(r.permissions)
        from public.role_assignments ra
        join public.roles r on r.id = ra.role_id
        where ra.person_id = (select person_id from me)
          and ra.scope_type = 'group'
          and ra.start_date <= current_date
          and (ra.end_date is null or ra.end_date >= current_date)
        union
        -- Délégué : il voit et suit les fidèles qui lui sont confiés.
        select unnest(array['people.view', 'alerts.view', 'alerts.manage'])
        from public.delegations d
        where d.delegate_id = (select person_id from me)
          and d.start_date <= current_date
          and (d.end_date is null or d.end_date >= current_date)
      ) as gp
    ), '[]'::jsonb),
    'roles', coalesce((
      select jsonb_agg(distinct r.label)
      from public.role_assignments ra
      join public.roles r on r.id = ra.role_id
      where ra.person_id = (select person_id from me)
        and ra.start_date <= current_date
        and (ra.end_date is null or ra.end_date >= current_date)
    ), '[]'::jsonb)
  );
$$;

-- ===========================================================================
-- Modules : portée du droit exigé (église, groupe ou les deux)
-- ===========================================================================
alter table public.modules
  add column required_scope text not null default 'any' check (required_scope in ('any', 'church', 'group'));

comment on column public.modules.required_scope is
  'Où le droit exigé doit être détenu : church (rôle d''église), group (fonction, rôle de groupe ou délégation), any.';

update public.modules set required_scope = 'church' where code = 'admin';

-- « Ma famille » : pères et mères de famille, adjoints, délégués.
update public.modules
set enabled = true, href = '/famille', required_permissions = '{people.view}', required_scope = 'group',
    description = 'Les fidèles de ma famille et leur suivi'
where code = 'family';

insert into public.modules (code, label, description, icon, href, enabled, home_position, nav_position,
                            required_permissions, required_scope)
values
  ('people', 'Fidèles', 'Registre de l''église, familles et non-rattachés', 'users-round', '/fideles', true,
   null, null, '{people.view}', 'church'),
  ('my_groups', 'Mes groupes', 'Ma famille, mes équipes, ma cellule', 'network', '/mes-groupes', true,
   null, null, '{}', 'any')
on conflict (code) do nothing;
