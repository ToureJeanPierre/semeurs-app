-- Lot 2 — Suivi des âmes et évangélisation (docs/01 §7, M4).
--
-- Une âme (visiteur, nouveau converti, en intégration) est suivie par plusieurs personnes :
-- père de famille, délégué, responsable évangélisation (toutes), gagneur d'âme (celles
-- qu'il a amenées, people.brought_by), membre évangélisation assigné (soul_assignments).
-- Tous partagent le même journal de suivi (follow_ups).
--
-- integration_steps / person_steps : parcours d'intégration, étapes paramétrables
-- outreach_outings / outreach_contacts : sorties d'évangélisation et contacts terrain

insert into public.permissions (code, label, description, position) values
  ('souls.manage', 'Suivre toutes les âmes', 'Voir et suivre toutes les âmes, assigner, organiser les sorties d''évangélisation', 18)
on conflict (code) do nothing;

update public.roles set permissions = array(select distinct unnest(permissions || '{souls.manage}'))
where code in ('evangelism_lead', 'pastor', 'assistant_pastor');

insert into public.settings (key, value, label, is_public) values
  ('soul_statuses', '["visitor", "new_convert", "integrating"]', 'Statuts considérés comme « âmes » à accompagner', false)
on conflict (key) do nothing;

insert into public.value_lists (list_code, value, label, position) values
  ('outreach_decision', 'accepted', 'A accepté Jésus', 1),
  ('outreach_decision', 'interested', 'Intéressé(e), à revoir', 2),
  ('outreach_decision', 'prayer', 'Demande de prière', 3),
  ('outreach_decision', 'other', 'Autre', 4)
on conflict (list_code, value) do nothing;

-- ===========================================================================
-- Parcours d'intégration
-- ===========================================================================
create table public.integration_steps (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  position integer not null default 0,
  due_days integer,                 -- délai conseillé après l'arrivée (jours), facultatif
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.integration_steps (code, label, position, due_days) values
  ('first_visit', 'Fiche de première visite', 1, 0),
  ('welcome', 'Message de bienvenue le jour même', 2, 0),
  ('call_72h', 'Appel sous 72 h', 3, 3),
  ('new_birth', 'Nouvelle naissance', 4, null),
  ('new_converts_course', 'Cours des nouveaux convertis', 5, null),
  ('baptism', 'Baptême', 6, null),
  ('family', 'Intégration dans une famille', 7, 30),
  ('team', 'Intégration dans une équipe', 8, null)
on conflict (code) do nothing;

create table public.person_steps (
  person_id uuid not null references public.people (id) on delete cascade,
  step_id uuid not null references public.integration_steps (id) on delete cascade,
  done_on date not null default current_date,
  done_by uuid references public.people (id) on delete set null,
  note text,
  primary key (person_id, step_id)
);

create table public.soul_assignments (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  assignee_id uuid not null references public.people (id) on delete cascade,
  start_date date not null default current_date,
  end_date date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create unique index soul_assignments_active_uniq on public.soul_assignments (person_id, assignee_id) where end_date is null;
create index soul_assignments_assignee_idx on public.soul_assignments (assignee_id) where end_date is null;
create index if not exists people_brought_by_idx on public.people (brought_by) where brought_by is not null;

-- ===========================================================================
-- Sorties d'évangélisation
-- ===========================================================================
create table public.outreach_outings (
  id uuid primary key default gen_random_uuid(),
  outing_date date not null default current_date,
  zone text not null check (length(trim(zone)) >= 2),
  group_id uuid references public.groups (id) on delete set null,   -- équipe qui sort
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create table public.outreach_contacts (
  id uuid primary key default gen_random_uuid(),
  outing_id uuid not null references public.outreach_outings (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  phone text,
  district text,
  decision text not null default 'interested',  -- liste « outreach_decision »
  note text,
  met_by uuid references public.people (id) on delete set null,   -- gagneur d'âme
  person_id uuid references public.people (id) on delete set null, -- fiche créée (contact converti)
  created_at timestamptz not null default now()
);

create index outreach_contacts_outing_idx on public.outreach_contacts (outing_id);

do $$
declare t text;
begin
  foreach t in array array['integration_steps', 'person_steps', 'soul_assignments', 'outreach_outings', 'outreach_contacts'] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.audit()',
      t || '_audit', t
    );
  end loop;
end;
$$;

-- ===========================================================================
-- Périmètre élargi : le gagneur d'âme voit et suit ceux qu'il a amenés ;
-- le membre évangélisation assigné, l'âme qui lui est confiée.
-- ===========================================================================
create or replace function private.my_souls()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.people p
  where p.brought_by = private.current_person_id() and p.deleted_at is null
  union
  select sa.person_id from public.soul_assignments sa
  where sa.assignee_id = private.current_person_id() and sa.end_date is null;
$$;

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
    or target in (select private.delegated_people())
    or target in (select private.my_souls());
$$;

create or replace function private.can_follow_person(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_permission('alerts.manage')
    or private.has_permission('souls.manage')
    or exists (
      select 1 from public.group_memberships gm
      where gm.person_id = target and gm.end_date is null
        and gm.group_id in (select private.groups_with_permission('alerts.manage'))
    )
    or target in (select private.delegated_people())
    or target in (select private.my_souls());
$$;

-- ===========================================================================
-- Droits
-- ===========================================================================
alter table public.integration_steps enable row level security;
alter table public.person_steps enable row level security;
alter table public.soul_assignments enable row level security;
alter table public.outreach_outings enable row level security;
alter table public.outreach_contacts enable row level security;

create policy "Lire les étapes" on public.integration_steps for select to authenticated using (true);
create policy "Paramétrer les étapes" on public.integration_steps for all to authenticated
  using ((select private.has_permission('settings.manage')))
  with check ((select private.has_permission('settings.manage')));

create policy "Voir le parcours" on public.person_steps for select to authenticated
  using ((select private.can_see_person(person_id)));
create policy "Valider une étape" on public.person_steps for insert to authenticated
  with check ((select private.can_follow_person(person_id)) and done_by = (select private.current_person_id()));
create policy "Annuler une étape" on public.person_steps for delete to authenticated
  using ((select private.can_follow_person(person_id)));

create policy "Voir les assignations" on public.soul_assignments for select to authenticated
  using (assignee_id = (select private.current_person_id()) or (select private.can_see_person(person_id)));
create policy "Assigner une âme" on public.soul_assignments for all to authenticated
  using ((select private.has_permission('souls.manage')))
  with check ((select private.has_permission('souls.manage')));

create or replace function private.in_outing_team(p_outing uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.outreach_outings o
    join public.group_memberships gm on gm.group_id = o.group_id and gm.end_date is null
    where o.id = p_outing and gm.person_id = private.current_person_id()
  );
$$;

create policy "Voir les sorties" on public.outreach_outings for select to authenticated
  using ((select private.has_permission('souls.manage')) or (select private.in_outing_team(id)));
create policy "Organiser une sortie" on public.outreach_outings for all to authenticated
  using ((select private.has_permission('souls.manage')))
  with check ((select private.has_permission('souls.manage')));

create policy "Voir les contacts terrain" on public.outreach_contacts for select to authenticated
  using ((select private.has_permission('souls.manage')) or (select private.in_outing_team(outing_id)));
create policy "Noter un contact terrain" on public.outreach_contacts for insert to authenticated
  with check ((select private.has_permission('souls.manage')) or (select private.in_outing_team(outing_id)));
create policy "Compléter un contact terrain" on public.outreach_contacts for update to authenticated
  using ((select private.has_permission('souls.manage')))
  with check ((select private.has_permission('souls.manage')));

revoke all on public.integration_steps, public.person_steps, public.soul_assignments, public.outreach_outings, public.outreach_contacts
  from anon, authenticated;
grant select, insert, update, delete on public.integration_steps, public.soul_assignments, public.outreach_outings to authenticated;
grant select, insert, delete on public.person_steps to authenticated;
grant select, insert, update on public.outreach_contacts to authenticated;
grant all on public.integration_steps, public.person_steps, public.soul_assignments, public.outreach_outings, public.outreach_contacts
  to service_role;

-- ===========================================================================
-- Fonctions
-- ===========================================================================

-- Fiche rapide de première visite. Tout membre peut inscrire une personne qu'il amène
-- (il en devient le gagneur) ; le responsable évangélisation inscrit pour n'importe qui.
create or replace function public.register_soul(
  p_first_name text, p_last_name text, p_sex text, p_phone text, p_district text,
  p_status text, p_brought_by uuid, p_note text, p_contact uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.current_person_id();
  manager boolean := private.has_permission('souls.manage') or private.has_permission('people.manage');
  new_id uuid := gen_random_uuid();
  first_step uuid;
begin
  if me is null then
    raise exception 'Compte non rattaché à une fiche.' using errcode = '42501';
  end if;
  if not manager and p_brought_by is distinct from me then
    raise exception 'Vous pouvez inscrire les personnes que vous amenez vous-même.' using errcode = '42501';
  end if;
  if p_status not in (select jsonb_array_elements_text(value) from public.settings where key = 'soul_statuses') then
    raise exception 'Statut inconnu.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_first_name, ''))) < 1 or length(trim(coalesce(p_last_name, ''))) < 1 then
    raise exception 'Nom et prénom sont nécessaires.' using errcode = 'P0001';
  end if;
  if p_contact is not null and not (manager or private.in_outing_team((select outing_id from public.outreach_contacts where id = p_contact))) then
    raise exception 'Contact hors de votre périmètre.' using errcode = '42501';
  end if;

  insert into public.people (id, first_name, last_name, sex, phone, district, commune, status, arrived_at, brought_by)
  values (new_id, trim(p_first_name), upper(trim(p_last_name)), nullif(p_sex, ''), nullif(p_phone, ''), nullif(trim(p_district), ''),
          'Yopougon', p_status, current_date, p_brought_by);

  select id into first_step from public.integration_steps where code = 'first_visit';
  if first_step is not null then
    insert into public.person_steps (person_id, step_id, done_by, note) values (new_id, first_step, me, nullif(trim(p_note), ''));
  end if;
  if p_contact is not null then
    update public.outreach_contacts set person_id = new_id where id = p_contact;
  end if;
  return new_id;
end;
$$;

revoke all on function public.register_soul(text, text, text, text, text, text, uuid, text, uuid) from public, anon;
grant execute on function public.register_soul(text, text, text, text, text, text, uuid, text, uuid) to authenticated;

-- Vue d'ensemble des âmes visibles par la personne connectée (parcours, gagneur, suivi).
create or replace function public.souls_overview()
returns table (
  id uuid, first_name text, last_name text, phone text, status text, arrived_at date,
  brought_by uuid, brought_by_name text, assignees text[], steps text[],
  in_family boolean, in_team boolean, last_contact date
)
language sql
stable
security definer
set search_path = ''
as $$
  with statuses as (
    select array(select jsonb_array_elements_text(value)) as s from public.settings where key = 'soul_statuses'
  )
  select p.id, p.first_name, p.last_name, coalesce(p.whatsapp, p.phone), p.status, p.arrived_at,
         p.brought_by, b.last_name || ' ' || b.first_name,
         array(select a.last_name || ' ' || a.first_name from public.soul_assignments sa join public.people a on a.id = sa.assignee_id
               where sa.person_id = p.id and sa.end_date is null),
         array(select st.code from public.person_steps ps join public.integration_steps st on st.id = ps.step_id where ps.person_id = p.id),
         exists (select 1 from public.group_memberships gm join public.groups g on g.id = gm.group_id
                 join public.group_types gt on gt.id = g.type_id and gt.slug = 'family'
                 where gm.person_id = p.id and gm.end_date is null),
         exists (select 1 from public.group_memberships gm join public.groups g on g.id = gm.group_id
                 join public.group_types gt on gt.id = g.type_id and gt.slug = 'team'
                 where gm.person_id = p.id and gm.end_date is null),
         (select max(f.created_at)::date from public.follow_ups f where f.person_id = p.id)
  from public.people p
  left join public.people b on b.id = p.brought_by
  cross join statuses
  where p.deleted_at is null
    and p.status = any (statuses.s)
    and private.can_see_person(p.id)
    and (private.has_permission('souls.manage') or private.has_permission('people.view')
         or p.id in (select private.my_souls())
         or exists (select 1 from public.group_memberships gm where gm.person_id = p.id and gm.end_date is null
                    and gm.group_id in (select private.groups_with_permission('alerts.manage'))))
  order by p.arrived_at desc nulls last, p.last_name;
$$;

revoke all on function public.souls_overview() from public, anon;
grant execute on function public.souls_overview() to authenticated;

-- Statistiques par gagneur d'âme (responsable évangélisation, pasteur).
create or replace function public.soul_winner_stats()
returns table (person_id uuid, name text, souls integer, integrated integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('souls.manage') then
    raise exception 'Réservé au responsable évangélisation.' using errcode = '42501';
  end if;
  return query
  select b.id, b.last_name || ' ' || b.first_name, count(*)::integer,
         count(*) filter (where exists (
           select 1 from public.group_memberships gm join public.groups g on g.id = gm.group_id
           join public.group_types gt on gt.id = g.type_id and gt.slug = 'family'
           where gm.person_id = p.id and gm.end_date is null))::integer
  from public.people p
  join public.people b on b.id = p.brought_by
  where p.deleted_at is null
  group by b.id, b.last_name, b.first_name
  order by count(*) desc, b.last_name;
end;
$$;

revoke all on function public.soul_winner_stats() from public, anon;
grant execute on function public.soul_winner_stats() to authenticated;

-- Âme confiée : la personne assignée est prévenue.
create or replace function private.notify_soul_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (person_id, title, body, link, kind)
  select new.assignee_id, 'Une âme vous est confiée', p.first_name || ' ' || p.last_name || ' : prenez de ses nouvelles.',
         '/ames/' || p.id, 'soul'
  from public.people p where p.id = new.person_id;
  return new;
end;
$$;

create trigger soul_assignments_notify after insert on public.soul_assignments
  for each row execute function private.notify_soul_assignment();

insert into public.modules (code, label, description, icon, href, enabled, home_position, nav_position, required_permissions, required_scope) values
  ('souls', 'Âmes', 'Nouvelles âmes, parcours d''intégration, sorties d''évangélisation', 'sprout', '/ames', true, null, null, '{}', 'any')
on conflict (code) do update set enabled = true, href = excluded.href, label = excluded.label, icon = excluded.icon;
