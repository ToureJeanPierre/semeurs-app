-- Lot 2 — Capacités des groupes (docs/01 §4, §9, §10.3 ; M6, M11).
--
-- Chaque capacité cochée sur un groupe s'y branche d'elle-même, quel que soit le groupe
-- (équipe, cellule, Jeunesse…) :
--   agenda            → group_events (activités ponctuelles ou chaque semaine)
--   attendance        → séances de groupe (sessions.group_id) et pointage par le responsable
--   service_planning  → group_duties (postes par date, roulement équitable)
--   prayer_chain      → group_duties (créneaux de prière) + prayer_requests (mur de prière)
--   resources         → group_resources (chants avec tonalité et paroles, textes, liens)
--   activity_reports  → group_reports (rapport après chaque rencontre ; nouveaux venus
--                       envoyés dans le parcours d'intégration ; alerte sans rapport)
--   announcements     → messages groupés existants (/messages)
-- Le lieu et l'horaire de rencontre (cellule : mardi par défaut) sont dans groups.settings.

update public.capabilities set available = true
where code in ('agenda', 'attendance', 'service_planning', 'resources', 'prayer_chain', 'activity_reports', 'announcements');

-- Le responsable et l'adjoint d'un groupe pointent ses rencontres.
update public.group_functions f set permissions = array(select distinct unnest(f.permissions || '{attendance.record}'))
from public.group_types t
where t.id = f.type_id and t.slug in ('team', 'cell', 'youth', 'sunday_school') and f.rank in (1, 2);

insert into public.settings (key, value, label, is_public) values
  ('report_alert_days', '14', 'Alerte si un groupe à rapports n''a rien envoyé depuis (jours)', false)
on conflict (key) do nothing;

insert into public.value_lists (list_code, value, label, position) values
  ('resource_kind', 'song', 'Chant', 1),
  ('resource_kind', 'text', 'Texte', 2),
  ('resource_kind', 'document', 'Document', 3),
  ('resource_kind', 'audio', 'Audio', 4),
  ('resource_kind', 'link', 'Lien', 5)
on conflict (list_code, value) do nothing;

-- ===========================================================================
-- Fonctions d'appartenance
-- ===========================================================================
create or replace function private.is_group_member(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_memberships gm
    where gm.group_id = p_group and gm.person_id = private.current_person_id() and gm.end_date is null
  );
$$;

-- Membre, responsable du groupe, ou droit d'église de voir les fiches.
create or replace function private.can_see_group(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_group_member(p_group) or private.has_permission('groups.manage', p_group) or private.has_permission('people.view');
$$;

-- ===========================================================================
-- Présences de groupe
-- ===========================================================================
drop policy "Pointer une présence" on public.attendance;
drop policy "Annuler un pointage" on public.attendance;
drop policy "Voir les présences de son périmètre" on public.attendance;

create or replace function private.can_record_session(p_session uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_permission('attendance.record')
    or exists (select 1 from public.sessions s where s.id = p_session and s.group_id is not null
               and private.has_permission('attendance.record', s.group_id));
$$;

create policy "Voir les présences de son périmètre" on public.attendance for select to authenticated
  using ((select private.can_record_session(session_id)) or (select private.can_see_person(person_id)));
create policy "Pointer une présence" on public.attendance for insert to authenticated
  with check (
    (select private.can_record_session(session_id))
    or (mode = 'manual' and (select private.can_manage_person(person_id)))
  );
create policy "Annuler un pointage" on public.attendance for delete to authenticated
  using (
    (select private.can_record_session(session_id))
    or (mode = 'manual' and (select private.can_manage_person(person_id)))
  );

-- Membres d'un groupe et présence à une séance (noms seulement), pour qui pointe ce groupe.
create or replace function public.group_roster(p_session uuid)
returns table (person_id uuid, name text, present boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare g uuid;
begin
  select group_id into g from public.sessions where id = p_session;
  if g is null or not private.can_record_session(p_session) then
    raise exception 'Réservé au responsable du groupe.' using errcode = '42501';
  end if;
  return query
  select p.id, upper(p.last_name) || ' ' || p.first_name,
         exists (select 1 from public.attendance a where a.session_id = p_session and a.person_id = p.id)
  from public.group_memberships gm
  join public.people p on p.id = gm.person_id and p.deleted_at is null
  where gm.group_id = g and gm.end_date is null
  order by p.last_name, p.first_name;
end;
$$;

revoke all on function public.group_roster(uuid) from public, anon;
grant execute on function public.group_roster(uuid) to authenticated;

-- Membres d'un groupe avec leur nom : pour ses membres si le type le permet, et pour ses responsables.
create or replace function public.group_people(p_group uuid)
returns table (person_id uuid, name text, function_label text, phone text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, upper(p.last_name) || ' ' || p.first_name, f.label,
         case when private.has_permission('people.view', p_group) then coalesce(p.whatsapp, p.phone) end
  from public.group_memberships gm
  join public.groups g on g.id = gm.group_id
  join public.group_types gt on gt.id = g.type_id
  join public.people p on p.id = gm.person_id and p.deleted_at is null
  left join public.group_functions f on f.id = gm.function_id
  where gm.group_id = p_group and gm.end_date is null
    and (private.has_permission('people.view', p_group) or private.has_permission('groups.manage', p_group)
         or (gt.members_see_each_other and private.is_group_member(p_group)))
  order by f.rank nulls last, p.last_name, p.first_name;
$$;

revoke all on function public.group_people(uuid) from public, anon;
grant execute on function public.group_people(uuid) to authenticated;

-- ===========================================================================
-- Agenda
-- ===========================================================================
create table public.group_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  title text not null check (length(trim(title)) >= 2),
  starts_at timestamptz not null,
  ends_at timestamptz,
  place text,
  recurrence text not null default 'none' check (recurrence in ('none', 'weekly')),
  until date,                       -- fin de la récurrence (facultatif)
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create index group_events_group_idx on public.group_events (group_id, starts_at);

-- ===========================================================================
-- Planning de service et chaîne de prière (même moteur : postes datés, roulement)
-- ===========================================================================
create table public.group_duties (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  capability_code text not null check (capability_code in ('service_planning', 'prayer_chain')),
  duty_date date not null,
  label text not null,              -- poste (« Accueil ») ou créneau (« 6 h – 7 h »)
  person_id uuid references public.people (id) on delete set null,
  assigned_by text not null default 'manual' check (assigned_by in ('auto', 'manual')),
  created_at timestamptz not null default now(),
  unique (group_id, capability_code, duty_date, label)
);

create index group_duties_person_idx on public.group_duties (person_id, duty_date);

-- ===========================================================================
-- Répertoire de ressources
-- ===========================================================================
create table public.group_resources (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  title text not null check (length(trim(title)) >= 2),
  kind text not null default 'song',   -- liste « resource_kind »
  music_key text,                      -- tonalité (chants)
  body text,                           -- paroles, texte
  url text check (url is null or url ~ '^https?://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create index group_resources_group_idx on public.group_resources (group_id, title);

-- ===========================================================================
-- Rapports de rencontre (cellules…)
-- ===========================================================================
create table public.group_reports (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  meeting_date date not null,
  present_count integer not null check (present_count >= 0),
  newcomers_count integer not null default 0 check (newcomers_count >= 0),
  theme text,
  prayer_subjects text,
  needs text,
  author_id uuid references public.people (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (group_id, meeting_date)
);

-- ===========================================================================
-- Mur de prière
-- ===========================================================================
create table public.prayer_requests (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.people (id) on delete cascade,
  body text not null check (length(trim(body)) >= 3),
  confidential boolean not null default false,   -- visible de l'auteur, du pasteur et des responsables d'intercession
  status text not null default 'open' check (status in ('open', 'answered')),
  answered_note text,                            -- témoignage « prière exaucée »
  answered_at timestamptz,
  prayed_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index prayer_requests_created_idx on public.prayer_requests (created_at desc);

do $$
declare t text;
begin
  foreach t in array array['group_events', 'group_duties', 'group_resources', 'group_reports', 'prayer_requests'] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.audit()',
      t || '_audit', t
    );
  end loop;
end;
$$;

create trigger group_resources_updated_at before update on public.group_resources
  for each row execute function public.set_updated_at();

-- Responsable d'un groupe ayant la chaîne de prière (intercession).
create or replace function private.leads_prayer_chain()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_capabilities gc
    where gc.capability_code = 'prayer_chain' and private.has_permission('groups.manage', gc.group_id)
  );
$$;

alter table public.group_events enable row level security;
alter table public.group_duties enable row level security;
alter table public.group_resources enable row level security;
alter table public.group_reports enable row level security;
alter table public.prayer_requests enable row level security;

create policy "Voir l'agenda du groupe" on public.group_events for select to authenticated
  using ((select private.can_see_group(group_id)));
create policy "Tenir l'agenda du groupe" on public.group_events for all to authenticated
  using ((select private.has_permission('groups.manage', group_id)))
  with check ((select private.has_permission('groups.manage', group_id)));

create policy "Voir le planning du groupe" on public.group_duties for select to authenticated
  using ((select private.can_see_group(group_id)) or person_id = (select private.current_person_id()));
create policy "Tenir le planning du groupe" on public.group_duties for all to authenticated
  using ((select private.has_permission('groups.manage', group_id)))
  with check ((select private.has_permission('groups.manage', group_id)));

create policy "Voir le répertoire du groupe" on public.group_resources for select to authenticated
  using ((select private.can_see_group(group_id)));
create policy "Tenir le répertoire du groupe" on public.group_resources for all to authenticated
  using ((select private.has_permission('groups.manage', group_id)))
  with check ((select private.has_permission('groups.manage', group_id)));

create policy "Voir les rapports du groupe" on public.group_reports for select to authenticated
  using ((select private.has_permission('groups.manage', group_id)) or (select private.has_permission('people.view')));
create policy "Rédiger un rapport" on public.group_reports for insert to authenticated
  with check ((select private.has_permission('groups.manage', group_id)) and author_id = (select private.current_person_id()));

create policy "Voir le mur de prière" on public.prayer_requests for select to authenticated
  using (
    not confidential
    or author_id = (select private.current_person_id())
    or (select private.has_permission('followups.confidential'))
    or (select private.leads_prayer_chain())
  );
create policy "Déposer un sujet de prière" on public.prayer_requests for insert to authenticated
  with check (author_id = (select private.current_person_id()));
create policy "Témoigner d'une prière exaucée" on public.prayer_requests for update to authenticated
  using (author_id = (select private.current_person_id()) or (select private.has_permission('followups.confidential')))
  with check (author_id = (select private.current_person_id()) or (select private.has_permission('followups.confidential')));
create policy "Retirer son sujet de prière" on public.prayer_requests for delete to authenticated
  using (author_id = (select private.current_person_id()));

revoke all on public.group_events, public.group_duties, public.group_resources, public.group_reports, public.prayer_requests
  from anon, authenticated;
grant select, insert, update, delete on public.group_events, public.group_duties, public.group_resources to authenticated;
grant select, insert on public.group_reports to authenticated;
grant select, insert, delete on public.prayer_requests to authenticated;
grant update (status, answered_note, answered_at) on public.prayer_requests to authenticated;
grant all on public.group_events, public.group_duties, public.group_resources, public.group_reports, public.prayer_requests
  to service_role;

-- « Je prie pour vous » : compteur, sans révéler qui.
create or replace function public.pray_for(p_request uuid)
returns integer
language sql
security definer
set search_path = ''
as $$
  update public.prayer_requests set prayed_count = prayed_count + 1
  where id = p_request and (not confidential or private.leads_prayer_chain() or private.has_permission('followups.confidential'))
  returning prayed_count;
$$;

revoke all on function public.pray_for(uuid) from public, anon;
grant execute on function public.pray_for(uuid) to authenticated;

-- Planning avec les noms (pour les membres du groupe et la personne de service).
create or replace function public.group_duties_view(p_group uuid, p_capability text, p_from date, p_to date)
returns table (id uuid, duty_date date, label text, person_id uuid, person_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.duty_date, d.label, d.person_id,
         case when p.id is null then null else upper(p.last_name) || ' ' || p.first_name end
  from public.group_duties d
  left join public.people p on p.id = d.person_id
  where d.group_id = p_group and d.capability_code = p_capability
    and d.duty_date between p_from and p_to
    and private.can_see_group(p_group)
  order by d.duty_date, d.label;
$$;

revoke all on function public.group_duties_view(uuid, text, date, date) from public, anon;
grant execute on function public.group_duties_view(uuid, text, date, date) to authenticated;

-- Alerte « pas de rapport depuis 14 jours » : responsables du groupe et pasteur, une fois par semaine.
create or replace function public.notify_missing_reports(p_today date default current_date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
  limit_days integer;
begin
  select coalesce((value #>> '{}')::integer, 14) into limit_days from public.settings where key = 'report_alert_days';
  with late as (
    select g.id, g.name,
           p_today - coalesce((select max(r.meeting_date) from public.group_reports r where r.group_id = g.id), g.created_at::date) as days
    from public.groups g
    join public.group_capabilities gc on gc.group_id = g.id and gc.capability_code = 'activity_reports'
    where g.active and g.deleted_at is null
  )
  insert into public.notifications (person_id, title, body, link, kind)
  select distinct x.person_id, 'Rapport attendu : ' || l.name,
         'Aucun rapport de rencontre depuis ' || l.days || ' jours.', '/mes-groupes/' || l.id, 'report'
  from late l
  cross join lateral (
    select gm.person_id from public.group_memberships gm join public.group_functions f on f.id = gm.function_id
    where gm.group_id = l.id and gm.end_date is null and 'groups.manage' = any (f.permissions)
    union
    select ra.person_id from public.role_assignments ra join public.roles r on r.id = ra.role_id
    where r.code = 'pastor' and ra.start_date <= p_today and (ra.end_date is null or ra.end_date >= p_today)
  ) x
  where l.days >= coalesce(limit_days, 14) and (l.days - coalesce(limit_days, 14)) % 7 = 0;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.notify_missing_reports(date) from public, anon, authenticated;
grant execute on function public.notify_missing_reports(date) to service_role;

-- Le module « Prières » de l'accueil devient actif (mur de prière de l'église).
update public.modules set enabled = true, href = '/priere' where code = 'prayer';
