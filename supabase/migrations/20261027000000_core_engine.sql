-- Lot 1, étape 1 — Le socle « tout se configure » (docs/01 §4 et §13, docs/02 §4.1 et §5).
--
-- Personnes        : people, users (lien compte ↔ personne)
-- Groupes          : group_types, groups, group_functions (le bureau), group_memberships
-- Capacités        : capabilities, group_capabilities
-- Droits           : permissions, roles, role_assignments
-- Paramètres       : value_lists (+ settings, déjà en place)
-- Traçabilité      : audit_log (insertion seule, alimenté par triggers)
--
-- Principe des droits : un droit (« people.view »…) s'obtient
--   - par un rôle d'église (administrateur, pasteur…) : il vaut partout ;
--   - par un rôle limité à un groupe (role_assignments.scope_type = 'group') ;
--   - par une fonction dans un groupe (père de famille, responsable d'équipe…) :
--     il vaut pour ce groupe seulement.
-- Toutes les vérifications passent par private.has_permission().

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ===========================================================================
-- Personnes
-- ===========================================================================
create table public.people (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (length(trim(first_name)) > 0),
  last_name text not null check (length(trim(last_name)) > 0),
  sex text check (sex in ('F', 'M')),
  birth_date date,
  phone text,          -- format international « +2250708310433 »
  whatsapp text,
  relative_phone text,
  commune text,
  district text,       -- quartier
  landmark text,       -- repère
  status text not null default 'member', -- liste de valeurs « person_status »
  arrived_at date,
  brought_by uuid references public.people (id) on delete set null,
  weekday_exempt boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null
);

comment on table public.people is 'Registre des personnes (fidèles, visiteurs, responsables).';
create index people_last_name_idx on public.people (lower(last_name), lower(first_name)) where deleted_at is null;
create index people_brought_by_idx on public.people (brought_by);
create index people_phone_idx on public.people (phone);

create trigger people_set_updated_at before update on public.people
  for each row execute function public.set_updated_at();

-- Lien entre un compte de connexion et une personne du registre (1 ↔ 1).
create table public.users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  person_id uuid not null unique references public.people (id) on delete cascade,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.users is 'Comptes de connexion rattachés à une personne du registre.';

-- ===========================================================================
-- Droits : catalogue, rôles, affectations
-- ===========================================================================
-- Catalogue des droits élémentaires. Chaque droit correspond à une
-- vérification réelle dans le code : on n'en ajoute qu'avec une capacité nouvelle.
create table public.permissions (
  code text primary key,
  label text not null,
  description text,
  position integer not null default 0
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  description text,
  permissions text[] not null default '{}',
  system boolean not null default false, -- rôle prévu au cahier des charges, non supprimable
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create trigger roles_set_updated_at before update on public.roles
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- Groupes
-- ===========================================================================
create table public.group_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,           -- « Famille »
  name_plural text not null,    -- « Familles »
  icon text not null default 'users-round',
  color text not null default '#1546B8',
  single_membership boolean not null default false, -- vrai : une personne n'est que dans un groupe de ce type
  default_capabilities text[] not null default '{}',
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create trigger group_types_set_updated_at before update on public.group_types
  for each row execute function public.set_updated_at();

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  type_id uuid not null references public.group_types (id),
  name text not null check (length(trim(name)) > 0),
  description text,
  color text,
  parent_id uuid references public.groups (id) on delete set null,
  settings jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null
);

create index groups_type_id_idx on public.groups (type_id) where deleted_at is null;
create index groups_parent_id_idx on public.groups (parent_id);

create trigger groups_set_updated_at before update on public.groups
  for each row execute function public.set_updated_at();

-- Le bureau d'un type de groupe : fonctions et droits qu'elles donnent dans le groupe.
create table public.group_functions (
  id uuid primary key default gen_random_uuid(),
  type_id uuid not null references public.group_types (id) on delete cascade,
  label text not null,
  rank integer not null default 0, -- 1 = premier responsable
  permissions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (type_id, label)
);

create trigger group_functions_set_updated_at before update on public.group_functions
  for each row execute function public.set_updated_at();

create table public.group_memberships (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  function_id uuid references public.group_functions (id) on delete set null, -- null = simple membre
  start_date date not null default current_date,
  end_date date, -- historique conservé : on clôt, on ne supprime pas
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  check (end_date is null or end_date >= start_date)
);

create index group_memberships_group_idx on public.group_memberships (group_id) where end_date is null;
create index group_memberships_person_idx on public.group_memberships (person_id) where end_date is null;
create index group_memberships_function_idx on public.group_memberships (function_id);
-- Une seule appartenance active d'une personne à un même groupe.
create unique index group_memberships_active_uniq on public.group_memberships (group_id, person_id)
  where end_date is null;

create trigger group_memberships_set_updated_at before update on public.group_memberships
  for each row execute function public.set_updated_at();

-- Affectation d'un rôle à une personne, sur un périmètre.
create table public.role_assignments (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  scope_type text not null default 'church' check (scope_type in ('church', 'group', 'subgroup', 'souls')),
  scope_id uuid, -- groupe concerné si scope_type = 'group'
  start_date date not null default current_date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  check (end_date is null or end_date >= start_date),
  check ((scope_type = 'church') = (scope_id is null))
);

create index role_assignments_person_idx on public.role_assignments (person_id) where end_date is null;
create index role_assignments_role_idx on public.role_assignments (role_id);

create trigger role_assignments_set_updated_at before update on public.role_assignments
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- Capacités
-- ===========================================================================
-- Une capacité = une fonctionnalité développée une fois, branchable sur tout groupe.
create table public.capabilities (
  code text primary key,
  label text not null,
  description text not null,
  available boolean not null default false, -- vrai quand la capacité est livrée
  position integer not null default 0
);

create table public.group_capabilities (
  group_id uuid not null references public.groups (id) on delete cascade,
  capability_code text not null references public.capabilities (code) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (group_id, capability_code)
);

create index group_capabilities_capability_idx on public.group_capabilities (capability_code);

-- ===========================================================================
-- Listes de valeurs
-- ===========================================================================
create table public.value_lists (
  id uuid primary key default gen_random_uuid(),
  list_code text not null,
  value text not null,
  label text not null,
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (list_code, value)
);

create trigger value_lists_set_updated_at before update on public.value_lists
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- Journal d'audit (insertion seule)
-- ===========================================================================
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid, -- compte auteur (null : serveur ou migration)
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  table_name text not null,
  record_id text,
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);

create index audit_log_table_record_idx on public.audit_log (table_name, record_id);
create index audit_log_at_idx on public.audit_log (at desc);

create or replace function private.audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (actor_id, action, table_name, record_id, before, after)
  values (
    (select auth.uid()),
    tg_op,
    tg_table_name,
    coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'id',
             (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'key',
             (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'code'),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'people', 'users', 'roles', 'role_assignments', 'group_types', 'groups', 'group_functions',
    'group_memberships', 'group_capabilities', 'value_lists', 'settings', 'modules',
    'service_types', 'daily_verses'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.audit()',
      t || '_audit', t
    );
  end loop;
end;
$$;

-- ===========================================================================
-- Règle « une seule famille » : types à appartenance unique
-- ===========================================================================
create or replace function private.check_single_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_single boolean;
  type_name text;
begin
  if new.end_date is not null then
    return new;
  end if;
  select gt.single_membership, gt.name into is_single, type_name
  from public.groups g join public.group_types gt on gt.id = g.type_id
  where g.id = new.group_id;

  if is_single and exists (
    select 1
    from public.group_memberships gm
    join public.groups g2 on g2.id = gm.group_id
    join public.groups g on g.id = new.group_id
    where gm.person_id = new.person_id
      and gm.end_date is null
      and gm.id <> new.id
      and g2.type_id = g.type_id
      and g2.id <> new.group_id
  ) then
    raise exception 'Cette personne appartient déjà à un groupe « % » : clôturez d''abord cette appartenance (transfert).', type_name
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger group_memberships_single
  before insert or update on public.group_memberships
  for each row execute function private.check_single_membership();

-- ===========================================================================
-- Fonctions de droits (schéma private, non exposé par l'API)
-- ===========================================================================
create or replace function private.current_person_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select person_id from public.users where user_id = (select auth.uid());
$$;

-- Vrai si la personne connectée a le droit `perm`, partout (rôle d'église)
-- ou dans le groupe `target_group` (rôle limité au groupe ou fonction dans le groupe).
create or replace function private.has_permission(perm text, target_group uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select private.current_person_id() as person_id)
  select exists (
    select 1
    from public.role_assignments ra
    join public.roles r on r.id = ra.role_id
    join me on me.person_id = ra.person_id
    where perm = any (r.permissions)
      and ra.start_date <= current_date
      and (ra.end_date is null or ra.end_date >= current_date)
      and (ra.scope_type = 'church' or (target_group is not null and ra.scope_id = target_group))
  ) or (target_group is not null and exists (
    select 1
    from public.group_memberships gm
    join public.group_functions f on f.id = gm.function_id
    join me on me.person_id = gm.person_id
    where gm.group_id = target_group
      and gm.end_date is null
      and perm = any (f.permissions)
  ));
$$;

-- Groupes dans lesquels la personne connectée a le droit `perm` par sa fonction
-- ou par un rôle limité au groupe (sans compter les rôles d'église).
create or replace function private.groups_with_permission(perm text)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select gm.group_id
  from public.group_memberships gm
  join public.group_functions f on f.id = gm.function_id
  where gm.person_id = private.current_person_id()
    and gm.end_date is null
    and perm = any (f.permissions)
  union
  select ra.scope_id
  from public.role_assignments ra
  join public.roles r on r.id = ra.role_id
  where ra.person_id = private.current_person_id()
    and ra.scope_type = 'group'
    and perm = any (r.permissions)
    and ra.start_date <= current_date
    and (ra.end_date is null or ra.end_date >= current_date);
$$;

-- Une personne est visible : elle-même, par un droit d'église « people.view »,
-- ou si elle est membre active d'un groupe où l'on a « people.view ».
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
    );
$$;

create or replace function private.can_manage_person(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_permission('people.manage')
    or exists (
      select 1
      from public.group_memberships gm
      where gm.person_id = target
        and gm.end_date is null
        and gm.group_id in (select private.groups_with_permission('people.manage'))
    );
$$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;

-- Ce que la personne connectée peut faire : sert à adapter l'interface
-- (menus, boutons). La sécurité réelle reste dans les règles RLS.
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

revoke all on function public.my_access() from public, anon;
grant execute on function public.my_access() to authenticated;

-- ===========================================================================
-- Règles RLS
-- ===========================================================================
alter table public.people enable row level security;
alter table public.users enable row level security;
alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.group_types enable row level security;
alter table public.groups enable row level security;
alter table public.group_functions enable row level security;
alter table public.group_memberships enable row level security;
alter table public.role_assignments enable row level security;
alter table public.capabilities enable row level security;
alter table public.group_capabilities enable row level security;
alter table public.value_lists enable row level security;
alter table public.audit_log enable row level security;

-- people -------------------------------------------------------------------
create policy "Voir les personnes de son périmètre" on public.people
  for select to authenticated
  using (deleted_at is null and (select private.can_see_person(id)));

create policy "Créer une personne (droit d'église)" on public.people
  for insert to authenticated
  with check ((select private.has_permission('people.manage')));

create policy "Modifier une personne de son périmètre" on public.people
  for update to authenticated
  using ((select private.can_manage_person(id)))
  with check ((select private.can_manage_person(id)));

-- users : chacun voit son lien ; les gestionnaires voient qui a un compte.
create policy "Voir les comptes" on public.users
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_permission('people.manage')));

-- Paramétrage lisible par toute personne connectée (aucune donnée personnelle) ----
create policy "Lire le catalogue des droits" on public.permissions for select to authenticated using (true);
create policy "Lire les rôles" on public.roles for select to authenticated using (true);
create policy "Lire les types de groupes" on public.group_types for select to authenticated using (true);
create policy "Lire les fonctions" on public.group_functions for select to authenticated using (true);
create policy "Lire les capacités" on public.capabilities for select to authenticated using (true);
create policy "Lire les listes de valeurs" on public.value_lists for select to authenticated using (true);
create policy "Lire les groupes" on public.groups for select to authenticated using (deleted_at is null);
create policy "Lire les capacités des groupes" on public.group_capabilities for select to authenticated using (true);

-- Paramétrage modifiable par l'administrateur (« settings.manage ») -------------
create policy "Créer un rôle" on public.roles for insert to authenticated
  with check ((select private.has_permission('settings.manage')));
create policy "Modifier un rôle" on public.roles for update to authenticated
  using ((select private.has_permission('settings.manage')))
  with check ((select private.has_permission('settings.manage')));
-- Les rôles prévus au cahier des charges (system) ne se suppriment pas.
create policy "Supprimer un rôle ajouté" on public.roles for delete to authenticated
  using (not system and (select private.has_permission('settings.manage')));
create policy "Gérer les types de groupes" on public.group_types for all to authenticated
  using ((select private.has_permission('settings.manage')))
  with check ((select private.has_permission('settings.manage')));
create policy "Gérer les fonctions" on public.group_functions for all to authenticated
  using ((select private.has_permission('settings.manage')))
  with check ((select private.has_permission('settings.manage')));
create policy "Gérer les listes de valeurs" on public.value_lists for all to authenticated
  using ((select private.has_permission('settings.manage')))
  with check ((select private.has_permission('settings.manage')));

-- Groupes : création par « groups.manage » d'église ; modification aussi par
-- le responsable du groupe (« groups.manage » dans le groupe).
create policy "Créer un groupe" on public.groups for insert to authenticated
  with check ((select private.has_permission('groups.manage')));
create policy "Modifier un groupe" on public.groups for update to authenticated
  using ((select private.has_permission('groups.manage', id)))
  with check ((select private.has_permission('groups.manage', id)));

create policy "Gérer les capacités d'un groupe" on public.group_capabilities for all to authenticated
  using ((select private.has_permission('groups.manage', group_id)))
  with check ((select private.has_permission('groups.manage', group_id)));

-- Appartenances : visibles si l'on voit la personne ou si l'on gère le groupe.
create policy "Voir les appartenances" on public.group_memberships for select to authenticated
  using (
    (select private.can_see_person(person_id))
    or (select private.has_permission('groups.manage', group_id))
  );
create policy "Gérer les appartenances" on public.group_memberships for all to authenticated
  using ((select private.has_permission('groups.manage', group_id)))
  with check ((select private.has_permission('groups.manage', group_id)));

-- Rôles attribués : chacun voit les siens ; « roles.manage » voit et gère tout.
create policy "Voir les rôles attribués" on public.role_assignments for select to authenticated
  using (person_id = (select private.current_person_id()) or (select private.has_permission('roles.manage')));
create policy "Attribuer les rôles" on public.role_assignments for all to authenticated
  using ((select private.has_permission('roles.manage')))
  with check ((select private.has_permission('roles.manage')));

-- Journal : lecture par « audit.view » ; aucune écriture directe (triggers seulement).
create policy "Lire le journal" on public.audit_log for select to authenticated
  using ((select private.has_permission('audit.view')));

-- Tables du lot 0 : l'administrateur peut désormais les modifier.
create policy "L'administrateur lit tous les paramètres" on public.settings for select to authenticated
  using ((select private.has_permission('settings.manage')));
create policy "L'administrateur modifie les paramètres" on public.settings for update to authenticated
  using ((select private.has_permission('settings.manage')))
  with check ((select private.has_permission('settings.manage')));
create policy "L'administrateur gère les cultes" on public.service_types for all to authenticated
  using ((select private.has_permission('settings.manage')))
  with check ((select private.has_permission('settings.manage')));
create policy "L'administrateur gère les versets" on public.daily_verses for all to authenticated
  using ((select private.has_permission('settings.manage')))
  with check ((select private.has_permission('settings.manage')));
create policy "L'administrateur gère les modules" on public.modules for update to authenticated
  using ((select private.has_permission('settings.manage')))
  with check ((select private.has_permission('settings.manage')));

-- Privilèges : rien pour anon ; le strict nécessaire pour authenticated (RLS en plus).
revoke all on public.people, public.users, public.permissions, public.roles, public.group_types,
  public.groups, public.group_functions, public.group_memberships, public.role_assignments,
  public.capabilities, public.group_capabilities, public.value_lists, public.audit_log
  from anon, authenticated;

grant select on public.permissions, public.capabilities, public.users, public.audit_log to authenticated;
grant select, insert, update on public.people, public.groups to authenticated;
grant select, insert, update, delete on public.roles, public.group_types, public.group_functions,
  public.group_memberships, public.role_assignments, public.group_capabilities, public.value_lists
  to authenticated;
grant update on public.settings, public.modules to authenticated;
grant insert, update, delete on public.service_types, public.daily_verses to authenticated;

grant all on public.people, public.users, public.permissions, public.roles, public.group_types,
  public.groups, public.group_functions, public.group_memberships, public.role_assignments,
  public.capabilities, public.group_capabilities, public.value_lists, public.audit_log
  to service_role;

-- ===========================================================================
-- Valeurs initiales (docs/01, docs/05) — toutes modifiables ensuite
-- ===========================================================================
insert into public.permissions (code, label, description, position) values
  ('settings.manage', 'Paramétrer l''application', 'Types de groupes, rôles, listes de valeurs, paramètres, modules', 1),
  ('roles.manage', 'Attribuer les rôles', 'Désigner l''administrateur, les assistants, les caissiers…', 2),
  ('groups.manage', 'Gérer les groupes', 'Créer et modifier familles, équipes, cellules ; affecter les membres', 3),
  ('people.view', 'Voir les fiches', 'Consulter les fiches des personnes du périmètre', 4),
  ('people.manage', 'Gérer les fiches', 'Créer et modifier les fiches des personnes du périmètre', 5),
  ('alerts.view', 'Voir les alertes', 'Voir les absences et le suivi', 6),
  ('alerts.manage', 'Suivre les absents', 'Noter les contacts, traiter les alertes', 7),
  ('audit.view', 'Consulter le journal', 'Voir qui a fait quoi et quand', 8);

insert into public.roles (code, label, description, permissions, system) values
  ('admin', 'Administrateur', 'Paramètre l''application. Désigné par le pasteur.',
   '{settings.manage,roles.manage,groups.manage,people.view,people.manage}', true),
  ('pastor', 'Pasteur', 'Vue complète de l''église, suivi pastoral.',
   '{roles.manage,people.view,people.manage,alerts.view,alerts.manage,audit.view}', true),
  ('assistant_pastor', 'Assistant pasteur', 'Seconde le pasteur dans le suivi.',
   '{people.view,people.manage,alerts.view,alerts.manage}', true),
  ('program_manager', 'Chargé du programme', 'Établit le programme des cultes.',
   '{people.view}', true),
  ('evangelism_lead', 'Responsable évangélisation', 'Suit les âmes et les non-rattachés.',
   '{people.view,people.manage,alerts.view,alerts.manage}', true),
  ('cashier', 'Caissier', 'Tient la caisse et les engagements.',
   '{people.view}', true),
  ('member', 'Fidèle', 'Accès à son espace personnel.', '{}', true);

insert into public.capabilities (code, label, description, position) values
  ('agenda', 'Agenda', 'Activités récurrentes ou ponctuelles du groupe', 1),
  ('attendance', 'Présences et alertes', 'Pointage et alertes d''absence, avec seuils propres', 2),
  ('contributions', 'Cotisations', 'Rubriques, versements, relances', 3),
  ('pledges', 'Engagements', 'Promesses de dons et suivi', 4),
  ('trainings', 'Formations', 'Programme, supports, progression', 5),
  ('service_planning', 'Planning de service', 'Postes à pourvoir par activité, roulement', 6),
  ('resources', 'Répertoire de ressources', 'Chants, textes, documents, audio', 7),
  ('prayer_chain', 'Chaîne de prière', 'Créneaux par roulement, sujets de prière', 8),
  ('inventory', 'Inventaire', 'Matériel confié au groupe', 9),
  ('activity_reports', 'Rapports d''activité', 'Formulaire rempli après chaque rencontre', 10),
  ('announcements', 'Annonces', 'Messages ciblés aux membres', 11);

insert into public.group_types (slug, name, name_plural, icon, color, single_membership, default_capabilities, position) values
  ('family', 'Famille', 'Familles', 'users-round', '#1546B8', true,
   '{attendance,contributions,pledges,announcements}', 1),
  ('team', 'Équipe', 'Équipes', 'sparkles', '#E9A90F', false,
   '{agenda,attendance,contributions,service_planning,trainings,announcements}', 2),
  ('cell', 'Cellule', 'Cellules', 'hands-praying', '#2E9D62', false,
   '{agenda,attendance,activity_reports,announcements}', 3),
  ('youth', 'Jeunesse', 'Jeunesse', 'sparkles', '#F08A1C', false,
   '{agenda,attendance,contributions,announcements}', 4),
  ('sunday_school', 'Classe d''école du dimanche', 'Classes d''école du dimanche', 'book-open', '#3BA7F0', false,
   '{agenda,attendance,trainings}', 5);

-- Bureau de chaque type (droits dans le groupe concerné uniquement).
insert into public.group_functions (type_id, label, rank, permissions)
select gt.id, f.label, f.rank, f.permissions::text[]
from public.group_types gt
join (values
  ('family', 'Père de famille', 1, '{people.view,people.manage,alerts.view,alerts.manage}'),
  ('family', 'Mère de famille', 2, '{people.view,people.manage,alerts.view,alerts.manage}'),
  ('family', 'Adjoint', 3, '{people.view,alerts.view,alerts.manage}'),
  ('family', 'Trésorière', 4, '{people.view}'),
  ('team', 'Responsable', 1, '{people.view,alerts.view,alerts.manage,groups.manage}'),
  ('team', 'Adjoint', 2, '{people.view,alerts.view,alerts.manage}'),
  ('team', 'Secrétaire', 3, '{people.view}'),
  ('cell', 'Responsable de cellule', 1, '{people.view,alerts.view,alerts.manage,groups.manage}'),
  ('cell', 'Adjoint', 2, '{people.view,alerts.view}'),
  ('youth', 'Responsable jeunesse', 1, '{people.view,alerts.view,alerts.manage,groups.manage}'),
  ('youth', 'Adjoint', 2, '{people.view,alerts.view}'),
  ('sunday_school', 'Moniteur', 1, '{people.view,alerts.view}')
) as f (slug, label, rank, permissions) on f.slug = gt.slug;

-- Groupes réels (docs/05) : 5 familles vides, 4 équipes, la Jeunesse, une cellule.
insert into public.groups (type_id, name, description)
select gt.id, g.name, g.description
from public.group_types gt
join (values
  ('family', 'Famille 1', null),
  ('family', 'Famille 2', null),
  ('family', 'Famille 3', null),
  ('family', 'Famille 4', null),
  ('family', 'Famille 5', null),
  ('team', 'Chantres et musiciens', 'Louange, chants et instruments'),
  ('team', 'Protocole', 'Accueil, ordre et pointage pendant les cultes'),
  ('team', 'Évangélisation', 'Annonce de l''Évangile et suivi des âmes'),
  ('team', 'Intercession', 'Chaîne de prière et jeûnes'),
  ('youth', 'Jeunesse', 'Jeunes de 14 à 50 ans'),
  ('cell', 'Camp Militaire, carrefour Niangon', 'Mardi 18 h – 19 h 30')
) as g (slug, name, description) on g.slug = gt.slug;

-- Chaque groupe reçoit les capacités par défaut de son type.
insert into public.group_capabilities (group_id, capability_code)
select g.id, c
from public.groups g
join public.group_types gt on gt.id = g.type_id
cross join lateral unnest(gt.default_capabilities) as c;

insert into public.value_lists (list_code, value, label, position) values
  ('person_status', 'visitor', 'Visiteur', 1),
  ('person_status', 'new_convert', 'Nouveau converti', 2),
  ('person_status', 'integrating', 'En intégration', 3),
  ('person_status', 'member', 'Membre', 4),
  ('person_status', 'inactive', 'Inactif', 5),
  ('person_status', 'left', 'Parti', 6),
  ('person_status', 'deceased', 'Décédé', 7),
  ('unattached_reason', 'new', 'Nouveau', 1),
  ('unattached_reason', 'waiting', 'En attente volontaire', 2),
  ('unattached_reason', 'not_oriented', 'Pas encore orienté', 3);

insert into public.settings (key, label, is_public, value) values
  ('alert_thresholds', 'Seuils d''alerte d''absence (jours)', false,
   jsonb_build_object('attention', 7, 'urgent', 14, 'critical', 21, 'lost', 30)),
  ('youth_age_range', 'Tranche d''âge de la Jeunesse', false, jsonb_build_object('min', 14, 'max', 50)),
  ('moderation_periods', 'Durées du programme de modération (mois)', false, '[2, 3, 6]'::jsonb),
  ('cashiers_count', 'Nombre de caissiers', false, '3'::jsonb),
  ('pledge_delay_notify_family_head', 'Signaler les retards d''engagement au père de famille', false, 'false'::jsonb),
  ('paid_channels', 'Services payants', false, jsonb_build_object('whatsapp_api', false, 'sms', false))
on conflict (key) do nothing;
