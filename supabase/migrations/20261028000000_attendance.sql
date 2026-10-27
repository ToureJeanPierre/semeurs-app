-- Lot 1, étape 3 — Pointage (docs/01 §6.4, docs/02 §4.2).
--
-- sessions           : une séance (culte du jour ou activité d'un groupe)
-- attendance         : une présence pointée (liste, QR code ou après coup)
-- excused_absences   : absence justifiée (voyage, maladie…) : suspend les alertes
-- person_qr_tokens   : code QR personnel, visible de la seule personne
--
-- Le protocole pointe sans voir les fiches : la liste à cocher ne montre que
-- les noms (fonction attendance_roster). Le père de famille peut pointer après
-- coup les membres de sa famille.

insert into public.permissions (code, label, description, position) values
  ('attendance.record', 'Pointer les présences', 'Tenir la liste de présence et scanner les QR codes', 9)
on conflict (code) do nothing;

insert into public.roles (code, label, description, permissions, system) values
  ('protocol', 'Agent du protocole', 'Pointe les présences aux cultes (liste ou QR code).', '{attendance.record}', true)
on conflict (code) do nothing;

update public.roles set permissions = array(select distinct unnest(permissions || '{attendance.record}'))
where code in ('admin', 'pastor', 'assistant_pastor');

insert into public.value_lists (list_code, value, label, position) values
  ('absence_reason', 'travel', 'Voyage', 1),
  ('absence_reason', 'illness', 'Maladie', 2),
  ('absence_reason', 'work', 'Travail', 3),
  ('absence_reason', 'family', 'Raison familiale', 4),
  ('absence_reason', 'other', 'Autre', 5)
on conflict (list_code, value) do nothing;

-- ===========================================================================
-- Séances
-- ===========================================================================
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  service_type_id uuid references public.service_types (id) on delete set null,
  group_id uuid references public.groups (id) on delete cascade,
  title text not null,
  session_date date not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  -- Compte pour les alertes d'absence (cultes de l'église) ; les activités de groupe, non.
  counts_for_alerts boolean not null default true,
  -- Culte du dimanche : seul pris en compte pour les fidèles dispensés des cultes de semaine.
  is_sunday_service boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

-- Un seul culte d'un type donné par jour.
create unique index sessions_service_day_uniq on public.sessions (service_type_id, session_date)
  where service_type_id is not null;
create index sessions_date_idx on public.sessions (session_date desc);
create index sessions_group_idx on public.sessions (group_id);

-- ===========================================================================
-- Présences
-- ===========================================================================
create table public.attendance (
  id uuid primary key default gen_random_uuid(), -- peut être généré sur le téléphone (hors connexion)
  session_id uuid not null references public.sessions (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  mode text not null check (mode in ('list', 'qr', 'manual')),
  recorded_at timestamptz not null default now(),
  recorded_by uuid references auth.users (id) on delete set null,
  unique (session_id, person_id)
);

create index attendance_person_idx on public.attendance (person_id, recorded_at desc);

create table public.excused_absences (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  reason text not null default 'other', -- liste « absence_reason »
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  check (ends_on >= starts_on)
);

create index excused_absences_person_idx on public.excused_absences (person_id, ends_on desc);

create table public.person_qr_tokens (
  person_id uuid primary key references public.people (id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(18), 'base64'),
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['sessions', 'attendance', 'excused_absences'] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.audit()',
      t || '_audit', t
    );
  end loop;
end;
$$;

-- ===========================================================================
-- Droits
-- ===========================================================================
alter table public.sessions enable row level security;
alter table public.attendance enable row level security;
alter table public.excused_absences enable row level security;
alter table public.person_qr_tokens enable row level security;

create policy "Voir les séances" on public.sessions for select to authenticated using (true);
create policy "Ouvrir une séance de culte" on public.sessions for insert to authenticated
  with check (
    (group_id is null and (select private.has_permission('attendance.record')))
    or (group_id is not null and (select private.has_permission('attendance.record', group_id)))
  );

create policy "Voir les présences de son périmètre" on public.attendance for select to authenticated
  using (
    (select private.has_permission('attendance.record'))
    or (select private.can_see_person(person_id))
  );
-- Le protocole pointe tout le monde ; le père de famille pointe après coup les siens.
create policy "Pointer une présence" on public.attendance for insert to authenticated
  with check (
    (select private.has_permission('attendance.record'))
    or (mode = 'manual' and (select private.can_manage_person(person_id)))
  );
create policy "Annuler un pointage" on public.attendance for delete to authenticated
  using (
    (select private.has_permission('attendance.record'))
    or (mode = 'manual' and (select private.can_manage_person(person_id)))
  );

create policy "Voir les absences justifiées" on public.excused_absences for select to authenticated
  using ((select private.can_see_person(person_id)));
-- La personne elle-même, ou qui gère sa fiche (père de famille…), déclare une absence.
create policy "Déclarer une absence" on public.excused_absences for insert to authenticated
  with check (
    person_id = (select private.current_person_id())
    or (select private.can_manage_person(person_id))
  );
create policy "Retirer une absence déclarée" on public.excused_absences for delete to authenticated
  using (
    person_id = (select private.current_person_id())
    or (select private.can_manage_person(person_id))
  );

create policy "Voir son propre code QR" on public.person_qr_tokens for select to authenticated
  using (person_id = (select private.current_person_id()));

revoke all on public.sessions, public.attendance, public.excused_absences, public.person_qr_tokens
  from anon, authenticated;
grant select, insert on public.sessions to authenticated;
grant select, insert, delete on public.attendance, public.excused_absences to authenticated;
grant select on public.person_qr_tokens to authenticated;
grant all on public.sessions, public.attendance, public.excused_absences, public.person_qr_tokens to service_role;

-- ===========================================================================
-- Fonctions
-- ===========================================================================
-- Ouvre (ou retrouve) le culte d'un type donné à une date. Les horaires viennent du type de culte.
create or replace function public.open_service_session(p_service_type uuid, p_date date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  st public.service_types;
  sid uuid;
begin
  if not private.has_permission('attendance.record') then
    raise exception 'Seul le protocole (ou le pasteur) ouvre le pointage d''un culte.' using errcode = '42501';
  end if;
  select * into st from public.service_types where id = p_service_type and active and deleted_at is null;
  if st.id is null then
    raise exception 'Type de culte inconnu.' using errcode = 'P0001';
  end if;
  select id into sid from public.sessions where service_type_id = st.id and session_date = p_date;
  if sid is null then
    insert into public.sessions (service_type_id, title, session_date, starts_at, ends_at, is_sunday_service, created_by)
    values (st.id, coalesce(st.short_name, st.name), p_date,
            (p_date + st.start_time) at time zone 'Africa/Abidjan',
            (p_date + st.end_time) at time zone 'Africa/Abidjan',
            st.weekday = 0, (select auth.uid()))
    returning id into sid;
  end if;
  return sid;
end;
$$;

-- Liste à cocher du protocole : noms et famille seulement (pas de coordonnées).
create or replace function public.attendance_roster(p_session uuid)
returns table (person_id uuid, name text, family text, present boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('attendance.record') then
    raise exception 'Accès réservé au protocole.' using errcode = '42501';
  end if;
  return query
  select p.id,
         upper(p.last_name) || ' ' || p.first_name,
         (select g.name from public.group_memberships gm
            join public.groups g on g.id = gm.group_id
            join public.group_types gt on gt.id = g.type_id and gt.slug = 'family'
          where gm.person_id = p.id and gm.end_date is null limit 1),
         exists (select 1 from public.attendance a where a.session_id = p_session and a.person_id = p.id)
  from public.people p
  where p.deleted_at is null and p.status not in ('left', 'deceased')
  order by p.last_name, p.first_name;
end;
$$;

-- Pointage par QR code : le jeton désigne la personne sans révéler qui elle est.
create or replace function public.record_attendance_by_qr(p_session uuid, p_token text, p_id uuid default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  pid uuid;
  who text;
begin
  if not private.has_permission('attendance.record') then
    raise exception 'Accès réservé au protocole.' using errcode = '42501';
  end if;
  select t.person_id, p.first_name || ' ' || upper(p.last_name) into pid, who
  from public.person_qr_tokens t join public.people p on p.id = t.person_id
  where t.token = p_token;
  if pid is null then
    raise exception 'Code QR inconnu.' using errcode = 'P0001';
  end if;
  insert into public.attendance (id, session_id, person_id, mode, recorded_by)
  values (coalesce(p_id, gen_random_uuid()), p_session, pid, 'qr', (select auth.uid()))
  on conflict (session_id, person_id) do nothing;
  return who;
end;
$$;

-- Mon code QR (créé à la première demande).
create or replace function public.my_qr_token()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.current_person_id();
  tok text;
begin
  if me is null then return null; end if;
  insert into public.person_qr_tokens (person_id) values (me) on conflict (person_id) do nothing;
  select token into tok from public.person_qr_tokens where person_id = me;
  return tok;
end;
$$;

revoke all on function public.open_service_session(uuid, date), public.attendance_roster(uuid),
  public.record_attendance_by_qr(uuid, text, uuid), public.my_qr_token() from public, anon;
grant execute on function public.open_service_session(uuid, date), public.attendance_roster(uuid),
  public.record_attendance_by_qr(uuid, text, uuid), public.my_qr_token() to authenticated;

-- Module « Pointage » (protocole, pasteur, administrateur) et « Mon espace » (tous).
insert into public.modules (code, label, description, icon, href, enabled, home_position, nav_position,
                            required_permissions, required_scope)
values
  ('attendance', 'Pointage', 'Pointer les présences au culte (liste ou QR code)', 'check-square', '/pointage', true,
   null, null, '{attendance.record}', 'church'),
  ('my_space', 'Mon espace', 'Mon code QR, mes absences, ma maison', 'user-round', '/mon-espace', true,
   null, null, '{}', 'any')
on conflict (code) do nothing;
