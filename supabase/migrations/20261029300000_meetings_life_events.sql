-- Lot 2 — Réunions (docs/01 §12.3, M22) et événements de vie (docs/01 §11, M14).
--
-- meetings / meeting_invitees / meeting_tasks : réunion (présentiel, en ligne via Jitsi
--   Meet gratuit, ou hybride), invités en un geste (famille, équipe, cellule, sélection),
--   réponses, rappels, puis présences, compte rendu, décisions et tâches.
-- life_events : naissance, mariage, deuil, hospitalisation… signalés au père de famille
--   et au pasteur ; en un geste : une cotisation de soutien ou une visite.

insert into public.permissions (code, label, description, position) values
  ('meetings.manage', 'Organiser des réunions', 'Créer une réunion, inviter, tenir le compte rendu', 17)
on conflict (code) do nothing;

update public.roles set permissions = array(select distinct unnest(permissions || '{meetings.manage}'))
where code in ('pastor', 'assistant_pastor', 'admin');

-- Dans les groupes : père et mère de famille, responsables d'équipe, de cellule, de la Jeunesse.
update public.group_functions f set permissions = array(select distinct unnest(f.permissions || '{meetings.manage}'))
from public.group_types t
where t.id = f.type_id and ((t.slug = 'family' and f.rank in (1, 2)) or (t.slug in ('team', 'cell', 'youth', 'sunday_school') and f.rank = 1));

insert into public.value_lists (list_code, value, label, position) values
  ('life_event_kind', 'birth', 'Naissance', 1),
  ('life_event_kind', 'wedding', 'Mariage', 2),
  ('life_event_kind', 'death', 'Deuil', 3),
  ('life_event_kind', 'hospitalization', 'Hospitalisation', 4),
  ('life_event_kind', 'illness', 'Maladie', 5),
  ('life_event_kind', 'other', 'Autre', 6)
on conflict (list_code, value) do nothing;

insert into public.settings (key, value, label, is_public) values
  ('meeting_online_base_url', '"https://meet.jit.si/"', 'Adresse des salles de réunion en ligne (Jitsi Meet, gratuit)', false)
on conflict (key) do nothing;

-- ===========================================================================
-- Réunions
-- ===========================================================================
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) >= 3),
  agenda text,                                    -- ordre du jour
  starts_at timestamptz not null,
  ends_at timestamptz,
  mode text not null default 'in_person' check (mode in ('in_person', 'online', 'hybrid')),
  place text,
  online_url text,
  group_id uuid references public.groups (id) on delete set null,   -- groupe principal (facultatif)
  organizer_id uuid not null references public.people (id) on delete restrict,
  status text not null default 'planned' check (status in ('planned', 'held', 'cancelled')),
  minutes text,                                   -- compte rendu
  decisions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meetings_starts_idx on public.meetings (starts_at);

create table public.meeting_invitees (
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  response text not null default 'pending' check (response in ('pending', 'yes', 'no', 'maybe')),
  attended boolean,
  responded_at timestamptz,
  primary key (meeting_id, person_id)
);

create index meeting_invitees_person_idx on public.meeting_invitees (person_id);

create table public.meeting_tasks (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  title text not null check (length(trim(title)) >= 3),
  assignee_id uuid references public.people (id) on delete set null,
  due_on date,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create index meeting_tasks_assignee_idx on public.meeting_tasks (assignee_id) where done_at is null;

create trigger meetings_updated_at before update on public.meetings
  for each row execute function public.set_updated_at();

do $$
declare t text;
begin
  foreach t in array array['meetings', 'meeting_invitees', 'meeting_tasks'] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.audit()',
      t || '_audit', t
    );
  end loop;
end;
$$;

create or replace function private.can_see_meeting(p_meeting uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.meetings m
    where m.id = p_meeting
      and (
        m.organizer_id = private.current_person_id()
        or private.has_permission('meetings.manage')
        or exists (select 1 from public.meeting_invitees i where i.meeting_id = m.id and i.person_id = private.current_person_id())
      )
  );
$$;

create or replace function private.can_run_meeting(p_meeting uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.meetings m
    where m.id = p_meeting
      and (m.organizer_id = private.current_person_id() or private.has_permission('meetings.manage'))
  );
$$;

alter table public.meetings enable row level security;
alter table public.meeting_invitees enable row level security;
alter table public.meeting_tasks enable row level security;

create policy "Voir ses réunions" on public.meetings for select to authenticated
  using ((select private.can_see_meeting(id)));
create policy "L'organisateur tient la réunion" on public.meetings for update to authenticated
  using ((select private.can_run_meeting(id)))
  with check ((select private.can_run_meeting(id)));

create policy "Voir les invités" on public.meeting_invitees for select to authenticated
  using ((select private.can_see_meeting(meeting_id)));
create policy "L'organisateur note les présences" on public.meeting_invitees for update to authenticated
  using ((select private.can_run_meeting(meeting_id)))
  with check ((select private.can_run_meeting(meeting_id)));

create policy "Voir les tâches" on public.meeting_tasks for select to authenticated
  using ((select private.can_see_meeting(meeting_id)));
create policy "L'organisateur répartit les tâches" on public.meeting_tasks for insert to authenticated
  with check ((select private.can_run_meeting(meeting_id)));
create policy "Mettre à jour une tâche" on public.meeting_tasks for update to authenticated
  using ((select private.can_run_meeting(meeting_id)) or assignee_id = (select private.current_person_id()))
  with check ((select private.can_run_meeting(meeting_id)) or assignee_id = (select private.current_person_id()));

revoke all on public.meetings, public.meeting_invitees, public.meeting_tasks from anon, authenticated;
grant select on public.meetings, public.meeting_invitees, public.meeting_tasks to authenticated;
grant update (title, agenda, starts_at, ends_at, mode, place, status, minutes, decisions) on public.meetings to authenticated;
grant update (attended) on public.meeting_invitees to authenticated;
grant insert on public.meeting_tasks to authenticated;
grant update (done_at) on public.meeting_tasks to authenticated;
grant all on public.meetings, public.meeting_invitees, public.meeting_tasks to service_role;

-- Création : vérifie le droit sur chaque groupe invité et sur chaque personne choisie.
create or replace function public.create_meeting(
  p_title text, p_agenda text, p_starts_at timestamptz, p_ends_at timestamptz,
  p_mode text, p_place text, p_group_ids uuid[], p_person_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.current_person_id();
  g uuid;
  new_id uuid := gen_random_uuid();
  base text;
  url text;
begin
  if me is null then
    raise exception 'Compte non rattaché à une fiche.' using errcode = '42501';
  end if;
  if coalesce(array_length(p_group_ids, 1), 0) = 0 and not private.has_permission('meetings.manage') then
    if not exists (select 1 from unnest(p_person_ids) x) then
      raise exception 'Choisissez au moins un groupe ou une personne à inviter.' using errcode = 'P0001';
    end if;
  end if;
  foreach g in array coalesce(p_group_ids, '{}') loop
    if not private.has_permission('meetings.manage', g) then
      raise exception 'Vous ne pouvez pas inviter ce groupe.' using errcode = '42501';
    end if;
  end loop;
  if not private.has_permission('meetings.manage')
     and not exists (select 1 from unnest(coalesce(p_group_ids, '{}')) x)
     and not exists (select 1 from public.groups gr where private.has_permission('meetings.manage', gr.id)) then
    raise exception 'Vous ne pouvez pas organiser de réunion.' using errcode = '42501';
  end if;
  if exists (select 1 from unnest(coalesce(p_person_ids, '{}')) pid where not private.can_see_person(pid)) then
    raise exception 'Une des personnes choisies est hors de votre périmètre.' using errcode = '42501';
  end if;
  if p_mode in ('online', 'hybrid') then
    select value #>> '{}' into base from public.settings where key = 'meeting_online_base_url';
    url := coalesce(base, 'https://meet.jit.si/') || 'Semeurs-' || replace(encode(extensions.gen_random_bytes(9), 'base64'), '/', 'x');
    url := replace(replace(url, '+', 'p'), '=', '');
  end if;

  insert into public.meetings (id, title, agenda, starts_at, ends_at, mode, place, online_url, group_id, organizer_id)
  values (new_id, trim(p_title), nullif(trim(p_agenda), ''), p_starts_at, p_ends_at, p_mode, nullif(trim(p_place), ''), url,
          (coalesce(p_group_ids, '{}'))[1], me);

  insert into public.meeting_invitees (meeting_id, person_id, response, responded_at)
  select new_id, x.person_id, case when x.person_id = me then 'yes' else 'pending' end,
         case when x.person_id = me then now() end
  from (
    select me as person_id
    union
    select gm.person_id from public.group_memberships gm
    where gm.group_id = any (coalesce(p_group_ids, '{}')) and gm.end_date is null
    union
    select unnest(coalesce(p_person_ids, '{}'))
  ) x
  join public.people p on p.id = x.person_id and p.deleted_at is null;

  insert into public.notifications (person_id, title, body, link, kind)
  select i.person_id, 'Invitation : ' || trim(p_title),
         to_char(p_starts_at, 'DD/MM à HH24"h"MI') || case p_mode when 'online' then ' · en ligne' when 'hybrid' then ' · sur place et en ligne' else coalesce(' · ' || nullif(trim(p_place), ''), '') end
           || '. Touchez pour répondre.',
         '/reunions/' || new_id, 'meeting'
  from public.meeting_invitees i where i.meeting_id = new_id and i.person_id <> me;
  return new_id;
end;
$$;

revoke all on function public.create_meeting(text, text, timestamptz, timestamptz, text, text, uuid[], uuid[]) from public, anon;
grant execute on function public.create_meeting(text, text, timestamptz, timestamptz, text, text, uuid[], uuid[]) to authenticated;

create or replace function public.respond_meeting(p_meeting uuid, p_response text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_response not in ('yes', 'no', 'maybe') then
    raise exception 'Réponse inconnue.' using errcode = 'P0001';
  end if;
  update public.meeting_invitees set response = p_response, responded_at = now()
  where meeting_id = p_meeting and person_id = private.current_person_id();
  if not found then
    raise exception 'Vous n''êtes pas invité(e) à cette réunion.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.respond_meeting(uuid, text) from public, anon;
grant execute on function public.respond_meeting(uuid, text) to authenticated;

-- Invités avec leur nom (pour tous ceux qui voient la réunion ; les fiches restent protégées).
create or replace function public.meeting_people(p_meeting uuid)
returns table (person_id uuid, name text, response text, attended boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select i.person_id, p.last_name || ' ' || p.first_name, i.response, i.attended
  from public.meeting_invitees i
  join public.people p on p.id = i.person_id
  where i.meeting_id = p_meeting and private.can_see_meeting(p_meeting)
  order by p.last_name, p.first_name;
$$;

revoke all on function public.meeting_people(uuid) from public, anon;
grant execute on function public.meeting_people(uuid) to authenticated;

-- Annulation : prévient les invités.
create or replace function private.notify_meeting_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    insert into public.notifications (person_id, title, body, link, kind)
    select i.person_id, 'Réunion annulée : ' || new.title, 'La réunion du ' || to_char(new.starts_at, 'DD/MM') || ' est annulée.',
           '/reunions/' || new.id, 'meeting'
    from public.meeting_invitees i where i.meeting_id = new.id and i.person_id <> new.organizer_id;
  elsif new.starts_at <> old.starts_at and new.status = 'planned' then
    insert into public.notifications (person_id, title, body, link, kind)
    select i.person_id, 'Réunion déplacée : ' || new.title, 'Nouvelle date : ' || to_char(new.starts_at, 'DD/MM à HH24"h"MI') || '.',
           '/reunions/' || new.id, 'meeting'
    from public.meeting_invitees i where i.meeting_id = new.id and i.person_id <> new.organizer_id and i.response <> 'no';
  end if;
  return new;
end;
$$;

create trigger meetings_notify after update on public.meetings
  for each row execute function private.notify_meeting_change();

-- Tâche confiée : la personne est prévenue.
create or replace function private.notify_meeting_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assignee_id is not null then
    insert into public.notifications (person_id, title, body, link, kind)
    select new.assignee_id, 'Tâche confiée', new.title || coalesce(' (avant le ' || to_char(new.due_on, 'DD/MM') || ')', '') || ' · ' || m.title,
           '/reunions/' || new.meeting_id, 'meeting'
    from public.meetings m where m.id = new.meeting_id;
  end if;
  return new;
end;
$$;

create trigger meeting_tasks_notify after insert on public.meeting_tasks
  for each row execute function private.notify_meeting_task();

-- Rappel la veille (cron quotidien, serveur seulement).
create or replace function public.notify_meeting_reminders(p_today date default current_date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  insert into public.notifications (person_id, title, body, link, kind)
  select i.person_id, 'Demain : ' || m.title,
         'À ' || to_char(m.starts_at, 'HH24"h"MI') || case when m.online_url is not null then ' · lien de la salle dans l''appli' else coalesce(' · ' || m.place, '') end || '.',
         '/reunions/' || m.id, 'meeting'
  from public.meetings m
  join public.meeting_invitees i on i.meeting_id = m.id and i.response <> 'no'
  where m.status = 'planned' and m.starts_at::date = p_today + 1;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.notify_meeting_reminders(date) from public, anon, authenticated;
grant execute on function public.notify_meeting_reminders(date) to service_role;

-- ===========================================================================
-- Événements de vie
-- ===========================================================================
create table public.life_events (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  kind text not null,                 -- liste « life_event_kind »
  event_date date not null default current_date,
  note text,
  status text not null default 'open' check (status in ('open', 'closed')),
  heading_id uuid references public.contribution_headings (id) on delete set null,
  reported_by uuid references public.people (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index life_events_person_idx on public.life_events (person_id, event_date desc);

create trigger life_events_updated_at before update on public.life_events
  for each row execute function public.set_updated_at();
create trigger life_events_audit after insert or update or delete on public.life_events
  for each row execute function private.audit();

alter table public.life_events enable row level security;

create policy "Voir les événements de vie" on public.life_events for select to authenticated
  using (reported_by = (select private.current_person_id()) or (select private.can_see_person(person_id)));
-- On signale pour soi, ou pour une personne que l'on voit (son père de famille, un responsable…).
create policy "Signaler un événement de vie" on public.life_events for insert to authenticated
  with check (
    reported_by = (select private.current_person_id())
    and (person_id = (select private.current_person_id()) or (select private.can_see_person(person_id)))
  );
create policy "Suivre un événement de vie" on public.life_events for update to authenticated
  using ((select private.can_follow_person(person_id)))
  with check ((select private.can_follow_person(person_id)));

revoke all on public.life_events from anon, authenticated;
grant select, insert on public.life_events to authenticated;
grant update (status, heading_id, note) on public.life_events to authenticated;
grant all on public.life_events to service_role;

-- Signalement : père / mère de famille (et adjoints), pasteur et assistants sont prévenus.
create or replace function private.notify_life_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  who text;
  what text;
begin
  select first_name || ' ' || last_name into who from public.people where id = new.person_id;
  select label into what from public.value_lists where list_code = 'life_event_kind' and value = new.kind;
  insert into public.notifications (person_id, title, body, link, kind)
  select distinct x.person_id, coalesce(what, 'Événement') || ' : ' || who,
         coalesce(new.note, 'Signalé dans l''appli.') , '/evenements-de-vie', 'life_event'
  from (
    select gm.person_id from public.group_memberships gm
    join public.group_functions f on f.id = gm.function_id
    join public.groups g on g.id = gm.group_id
    join public.group_types gt on gt.id = g.type_id and gt.slug = 'family'
    where gm.end_date is null and 'alerts.manage' = any (f.permissions)
      and gm.group_id in (select m.group_id from public.group_memberships m where m.person_id = new.person_id and m.end_date is null)
    union
    select ra.person_id from public.role_assignments ra join public.roles r on r.id = ra.role_id
    where r.code in ('pastor', 'assistant_pastor') and ra.scope_type = 'church'
      and ra.start_date <= current_date and (ra.end_date is null or ra.end_date >= current_date)
  ) x
  where x.person_id is distinct from new.reported_by;
  return new;
end;
$$;

create trigger life_events_notify after insert on public.life_events
  for each row execute function private.notify_life_event();

-- Modules : Réunions et Événements de vie (menu).
insert into public.modules (code, label, description, icon, href, enabled, home_position, nav_position, required_permissions, required_scope) values
  ('meetings', 'Réunions', 'Réunions sur place ou en ligne, comptes rendus, tâches', 'video', '/reunions', true, null, null, '{}', 'any'),
  ('life_events', 'Événements de vie', 'Naissance, mariage, deuil, maladie : prévenir et accompagner', 'baby', '/evenements-de-vie', true, null, null, '{}', 'any')
on conflict (code) do update set enabled = true, href = excluded.href, label = excluded.label, icon = excluded.icon;
