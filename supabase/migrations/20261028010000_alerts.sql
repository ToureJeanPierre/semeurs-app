-- Lot 1, étape 4 — Alertes d'absence, journal de suivi, notifications (docs/01 §6.5, §6.6 ; docs/02 §6.1).
--
-- alerts         : état d'assiduité actuel de chaque personne suivie (une ligne par personne)
-- alert_events   : historique des changements de niveau
-- follow_ups     : journal de suivi (appel, WhatsApp, visite…) ; noter un contact « traite » l'alerte
-- notifications  : messages dans l'appli (cloche), un par destinataire
--
-- Calcul quotidien (compute_alerts, 6 h à Abidjan) : jours depuis la dernière présence
-- à un culte qui compte (dimanche seul si dispensé des cultes de semaine). On ne
-- compte une absence que si un culte pointé a eu lieu depuis : pas de fausse alerte
-- tant que l'église ne pointe pas. Une absence justifiée en cours suspend l'alerte.

insert into public.permissions (code, label, description, position) values
  ('followups.confidential', 'Lire les notes sensibles', 'Notes de suivi marquées « sensibles » (pasteur)', 10),
  ('messages.send', 'Envoyer des messages groupés', 'Annonces et messages aux membres de son périmètre', 11)
on conflict (code) do nothing;

update public.roles set permissions = array(select distinct unnest(permissions || '{followups.confidential,messages.send}'))
where code = 'pastor';
update public.roles set permissions = array(select distinct unnest(permissions || '{messages.send}'))
where code in ('admin', 'assistant_pastor', 'evangelism_lead');
update public.group_functions set permissions = array(select distinct unnest(permissions || '{messages.send}'))
where 'groups.manage' = any (permissions) or label in ('Père de famille', 'Mère de famille');

insert into public.value_lists (list_code, value, label, position) values
  ('contact_channel', 'call', 'Appel', 1),
  ('contact_channel', 'whatsapp', 'WhatsApp', 2),
  ('contact_channel', 'sms', 'SMS', 3),
  ('contact_channel', 'visit', 'Visite', 4),
  ('contact_channel', 'other', 'Autre', 5),
  ('contact_result', 'reached', 'Joint, va bien', 1),
  ('contact_result', 'unreachable', 'Injoignable', 2),
  ('contact_result', 'sick', 'Malade', 3),
  ('contact_result', 'traveling', 'En voyage', 4),
  ('contact_result', 'moved', 'A déménagé', 5),
  ('contact_result', 'discouraged', 'Découragé(e)', 6),
  ('contact_result', 'other', 'Autre', 7)
on conflict (list_code, value) do nothing;

insert into public.settings (key, label, is_public, value) values
  ('alert_statuses', 'Statuts suivis par les alertes d''absence', false, '["member", "integrating", "new_convert"]'::jsonb)
on conflict (key) do nothing;

-- ===========================================================================
-- Tables
-- ===========================================================================
create table public.alerts (
  person_id uuid primary key references public.people (id) on delete cascade,
  level text not null check (level in ('ok', 'attention', 'urgent', 'critical', 'lost', 'excused')),
  days_absent integer not null default 0,
  last_presence_on date,
  level_since date not null default current_date,
  status text not null default 'closed' check (status in ('open', 'treated', 'closed')),
  treated_at timestamptz,
  computed_at timestamptz not null default now()
);

create index alerts_level_idx on public.alerts (level) where level not in ('ok', 'excused');

create table public.alert_events (
  id bigint generated always as identity primary key,
  person_id uuid not null references public.people (id) on delete cascade,
  from_level text,
  to_level text not null,
  days_absent integer not null,
  at timestamptz not null default now()
);

create index alert_events_person_idx on public.alert_events (person_id, at desc);

create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  author_id uuid references public.people (id) on delete set null,
  channel text not null,        -- liste « contact_channel »
  result text not null,         -- liste « contact_result »
  note text,
  confidential boolean not null default false,
  next_action_on date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create index follow_ups_person_idx on public.follow_ups (person_id, created_at desc);
create index follow_ups_author_idx on public.follow_ups (author_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade, -- destinataire
  title text not null,
  body text,
  link text,
  kind text not null default 'info', -- alert, birthday, message, appointment, info
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_person_idx on public.notifications (person_id, created_at desc);
create index notifications_unread_idx on public.notifications (person_id) where read_at is null;

create trigger follow_ups_audit after insert or update or delete on public.follow_ups
  for each row execute function private.audit();

-- ===========================================================================
-- Droits
-- ===========================================================================
-- Peut suivre (appeler, noter un contact) : droit d'église, fonction dans un groupe
-- de la personne, ou délégation.
create or replace function private.can_follow_person(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_permission('alerts.manage')
    or exists (
      select 1 from public.group_memberships gm
      where gm.person_id = target and gm.end_date is null
        and gm.group_id in (select private.groups_with_permission('alerts.manage'))
    )
    or target in (select private.delegated_people());
$$;

-- Notes sensibles : l'auteur, le pasteur (droit dédié) et le père de famille (gère la fiche).
create or replace function private.can_read_follow_up(target uuid, is_confidential boolean, author uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not is_confidential then private.can_follow_person(target) or private.has_permission('alerts.view')
    else author = private.current_person_id()
      or private.has_permission('followups.confidential')
      or exists (
        select 1 from public.group_memberships gm
        where gm.person_id = target and gm.end_date is null
          and gm.group_id in (select private.groups_with_permission('people.manage'))
      )
  end;
$$;

revoke all on function private.can_follow_person(uuid), private.can_read_follow_up(uuid, boolean, uuid) from public, anon;
grant execute on function private.can_follow_person(uuid), private.can_read_follow_up(uuid, boolean, uuid) to authenticated;

alter table public.alerts enable row level security;
alter table public.alert_events enable row level security;
alter table public.follow_ups enable row level security;
alter table public.notifications enable row level security;

create policy "Voir les alertes de son périmètre" on public.alerts for select to authenticated
  using ((select private.can_follow_person(person_id)) or (select private.has_permission('alerts.view')));
create policy "Voir l'historique des alertes" on public.alert_events for select to authenticated
  using ((select private.can_follow_person(person_id)) or (select private.has_permission('alerts.view')));

create policy "Lire le journal de suivi" on public.follow_ups for select to authenticated
  using ((select private.can_read_follow_up(person_id, confidential, author_id)));
create policy "Noter un contact" on public.follow_ups for insert to authenticated
  with check (
    (select private.can_follow_person(person_id))
    and author_id = (select private.current_person_id())
  );

create policy "Voir ses notifications" on public.notifications for select to authenticated
  using (person_id = (select private.current_person_id()));
create policy "Marquer ses notifications comme lues" on public.notifications for update to authenticated
  using (person_id = (select private.current_person_id()))
  with check (person_id = (select private.current_person_id()));

revoke all on public.alerts, public.alert_events, public.follow_ups, public.notifications from anon, authenticated;
grant select on public.alerts, public.alert_events to authenticated;
grant select, insert on public.follow_ups to authenticated;
grant select, update (read_at) on public.notifications to authenticated;
grant all on public.alerts, public.alert_events, public.follow_ups, public.notifications to service_role;

-- Noter un contact « traite » l'alerte ouverte.
create or replace function private.follow_up_treats_alert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.alerts set status = 'treated', treated_at = now()
  where person_id = new.person_id and status = 'open';
  return null;
end;
$$;

create trigger follow_ups_treat_alert after insert on public.follow_ups
  for each row execute function private.follow_up_treats_alert();

-- ===========================================================================
-- Calcul quotidien
-- ===========================================================================
create or replace function private.level_rank(level text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case level when 'attention' then 1 when 'urgent' then 2 when 'critical' then 3 when 'lost' then 4 else 0 end;
$$;

-- Destinataires des notifications pour une personne et un niveau (docs/01 §6.5).
create or replace function private.alert_recipients(target uuid, level text)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  with family as (
    select gm.group_id from public.group_memberships gm
    join public.groups g on g.id = gm.group_id
    join public.group_types gt on gt.id = g.type_id and gt.slug = 'family'
    where gm.person_id = target and gm.end_date is null
    limit 1
  ),
  church_role as (
    select ra.person_id, r.code from public.role_assignments ra
    join public.roles r on r.id = ra.role_id
    where ra.scope_type = 'church' and ra.start_date <= current_date
      and (ra.end_date is null or ra.end_date >= current_date)
  )
  -- Délégué : dès « Attention »
  select d.delegate_id from public.delegations d
  join public.delegation_members dm on dm.delegation_id = d.id
  where dm.person_id = target and d.start_date <= current_date
    and (d.end_date is null or d.end_date >= current_date) and private.level_rank(level) >= 1
  union
  -- Père / mère de famille, adjoints : dès « Attention »
  select gm.person_id from public.group_memberships gm
  join public.group_functions f on f.id = gm.function_id
  where gm.group_id in (select group_id from family) and gm.end_date is null
    and 'alerts.manage' = any (f.permissions) and private.level_rank(level) >= 1
  union
  -- Assistants pasteur : dès « Critique »
  select person_id from church_role where code = 'assistant_pastor' and private.level_rank(level) >= 3
  union
  -- Pasteur et responsable évangélisation : « Perdu de vue »
  select person_id from church_role where code in ('pastor', 'evangelism_lead') and private.level_rank(level) >= 4
  union
  -- Sans famille : responsable évangélisation et gagneur d'âme, dès « Attention »
  select person_id from church_role
  where code = 'evangelism_lead' and not exists (select 1 from family) and private.level_rank(level) >= 1
  union
  select p.brought_by from public.people p
  where p.id = target and p.brought_by is not null and not exists (select 1 from family) and private.level_rank(level) >= 1;
$$;

create or replace function public.compute_alerts(p_today date default (now() at time zone 'Africa/Abidjan')::date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  t jsonb := (select value from public.settings where key = 'alert_thresholds');
  statuses text[] := array(select jsonb_array_elements_text(coalesce(
    (select value from public.settings where key = 'alert_statuses'), '["member"]'::jsonb)));
  labels jsonb := '{"attention": "Attention", "urgent": "Urgent", "critical": "Critique", "lost": "Perdu de vue"}';
  r record;
  ref date;
  missed boolean;
  days integer;
  new_level text;
  old public.alerts;
  changed integer := 0;
begin
  for r in
    select p.id, p.first_name, p.last_name, p.weekday_exempt, coalesce(p.arrived_at, p.created_at::date) as since,
           (select max(s.session_date) from public.attendance a join public.sessions s on s.id = a.session_id
             where a.person_id = p.id and s.counts_for_alerts and (not p.weekday_exempt or s.is_sunday_service)) as last_presence
    from public.people p
    where p.deleted_at is null and p.status = any (statuses)
  loop
    ref := coalesce(r.last_presence, r.since);
    -- Un culte (qui compte pour lui) a-t-il eu lieu depuis ?
    select exists (
      select 1 from public.sessions s
      where s.counts_for_alerts and s.session_date > ref and s.session_date <= p_today
        and (not r.weekday_exempt or s.is_sunday_service)
    ) into missed;
    days := case when missed then p_today - ref else 0 end;

    if exists (select 1 from public.excused_absences e where e.person_id = r.id and p_today between e.starts_on and e.ends_on) then
      new_level := 'excused';
    else
      new_level := case
        when days >= (t ->> 'lost')::int then 'lost'
        when days >= (t ->> 'critical')::int then 'critical'
        when days >= (t ->> 'urgent')::int then 'urgent'
        when days >= (t ->> 'attention')::int then 'attention'
        else 'ok'
      end;
    end if;

    select * into old from public.alerts where person_id = r.id;

    if old.person_id is null or old.level <> new_level then
      insert into public.alerts (person_id, level, days_absent, last_presence_on, level_since, status, treated_at, computed_at)
      values (r.id, new_level, days, r.last_presence, p_today,
              case when private.level_rank(new_level) >= 1 then 'open' else 'closed' end, null, now())
      on conflict (person_id) do update set
        level = excluded.level, days_absent = excluded.days_absent, last_presence_on = excluded.last_presence_on,
        level_since = excluded.level_since, status = excluded.status, treated_at = null, computed_at = now();
      insert into public.alert_events (person_id, from_level, to_level, days_absent)
      values (r.id, old.level, new_level, days);
      changed := changed + 1;

      -- Une notification au changement de niveau seulement, en montant.
      if private.level_rank(new_level) > private.level_rank(coalesce(old.level, 'ok')) then
        insert into public.notifications (person_id, title, body, link, kind)
        select rec, (labels ->> new_level) || ' : ' || r.first_name || ' ' || upper(r.last_name),
               'Absent(e) depuis ' || days || ' jours. Prenez de ses nouvelles.',
               '/fideles/' || r.id, 'alert'
        from private.alert_recipients(r.id, new_level) as rec
        where rec is not null and rec <> r.id;
      end if;
    else
      update public.alerts set days_absent = days, last_presence_on = r.last_presence, computed_at = now()
      where person_id = r.id;
    end if;
  end loop;
  return changed;
end;
$$;

revoke all on function public.compute_alerts(date), private.alert_recipients(uuid, text) from public, anon, authenticated;
grant execute on function public.compute_alerts(date) to service_role;

-- Nombre de notifications non lues (pastille de la cloche).
create or replace function public.unread_notifications()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.notifications
  where person_id = private.current_person_id() and read_at is null;
$$;

revoke all on function public.unread_notifications() from public, anon;
grant execute on function public.unread_notifications() to authenticated;

-- Module « Alertes » : vue d'ensemble pour le pasteur, ses assistants, l'évangélisation.
insert into public.modules (code, label, description, icon, href, enabled, home_position, nav_position,
                            required_permissions, required_scope)
values ('alerts', 'Absences', 'Fidèles à contacter, par niveau d''alerte', 'bell-ring', '/alertes', true,
        null, null, '{alerts.view}', 'church')
on conflict (code) do nothing;
