-- Lot 3 — Espace pastoral et Jeunesse (docs/01 §9, §10.4 ; M7, M9, M12).
--
-- care_notes            : dossiers de cure d'âme, CHIFFRÉS par le serveur (clé hors base,
--                         variable CARE_NOTES_KEY), lisibles du seul pasteur (droit care.notes)
-- pastor_dashboard()    : vue d'ensemble (indicateurs choisis dans settings.dashboard_widgets)
-- Jeunesse              : appartenance automatique selon l'âge (settings.youth_age_range) ;
--                         un retrait manuel est respecté (on ne réinscrit pas)
-- group_event_rsvps     : « Je participe » aux activités des groupes
-- group_ideas / votes   : boîte à idées (capacité « ideas »)

insert into public.permissions (code, label, description, position) values
  ('care.notes', 'Dossiers de cure d''âme', 'Lire et écrire les notes pastorales chiffrées', 22)
on conflict (code) do nothing;
update public.roles set permissions = array(select distinct unnest(permissions || '{care.notes}')) where code = 'pastor';

insert into public.settings (key, value, label, is_public) values
  ('dashboard_widgets', '["members", "attendance", "alerts", "souls", "cells", "finances", "pledges", "audiences", "life_events"]',
   'Indicateurs affichés sur la vue d''ensemble du pasteur', false)
on conflict (key) do nothing;

insert into public.capabilities (code, label, description, available, position)
values ('ideas', 'Boîte à idées', 'Les membres proposent des idées et votent', true, 12)
on conflict (code) do update set available = true;
update public.group_types set default_capabilities = array(select distinct unnest(default_capabilities || '{ideas}')) where slug = 'youth';
insert into public.group_capabilities (group_id, capability_code)
select g.id, 'ideas' from public.groups g join public.group_types gt on gt.id = g.type_id where gt.slug = 'youth'
on conflict do nothing;

-- ===========================================================================
-- Cure d'âme
-- ===========================================================================
create table public.care_notes (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  ciphertext text not null,      -- AES-256-GCM, chiffré par le serveur ; la base ne voit jamais le texte
  iv text not null,
  tag text not null,
  author_id uuid references public.people (id) on delete set null,
  created_at timestamptz not null default now()
);

create index care_notes_person_idx on public.care_notes (person_id, created_at desc);
create trigger care_notes_audit after insert or update or delete on public.care_notes
  for each row execute function private.audit();

alter table public.care_notes enable row level security;
create policy "Cure d'âme : pasteur seul (lecture)" on public.care_notes for select to authenticated
  using ((select private.has_permission('care.notes')));
create policy "Cure d'âme : pasteur seul (écriture)" on public.care_notes for insert to authenticated
  with check ((select private.has_permission('care.notes')) and author_id = (select private.current_person_id()));
revoke all on public.care_notes from anon, authenticated;
grant select, insert on public.care_notes to authenticated;
grant all on public.care_notes to service_role;

-- ===========================================================================
-- Jeunesse : appartenance automatique selon l'âge
-- ===========================================================================
alter table public.group_memberships add column auto boolean not null default false;

create or replace function public.sync_youth(p_today date default current_date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  lo integer;
  hi integer;
  n integer := 0;
  m integer := 0;
begin
  select (value ->> 'min')::integer, (value ->> 'max')::integer into lo, hi from public.settings where key = 'youth_age_range';
  lo := coalesce(lo, 14); hi := coalesce(hi, 50);
  -- Entrées : âge dans la tranche, jamais retiré(e) à la main de ce groupe.
  insert into public.group_memberships (group_id, person_id, auto)
  select g.id, p.id, true
  from public.groups g
  join public.group_types gt on gt.id = g.type_id and gt.slug = 'youth'
  cross join public.people p
  where g.active and g.deleted_at is null and not g.is_demo
    and p.deleted_at is null and not p.is_demo and p.birth_date is not null
    and p.status not in ('left', 'deceased')
    and extract(year from age(p_today, p.birth_date)) between lo and hi
    and not exists (select 1 from public.group_memberships x where x.group_id = g.id and x.person_id = p.id);
  get diagnostics n = row_count;
  -- Sorties : les inscriptions automatiques des personnes sorties de la tranche d'âge.
  update public.group_memberships gm set end_date = p_today
  from public.people p, public.groups g, public.group_types gt
  where gm.person_id = p.id and gm.group_id = g.id and gt.id = g.type_id and gt.slug = 'youth'
    and gm.auto and gm.end_date is null and p.birth_date is not null
    and extract(year from age(p_today, p.birth_date)) not between lo and hi;
  get diagnostics m = row_count;
  return n + m;
end;
$$;

revoke all on function public.sync_youth(date) from public, anon, authenticated;
grant execute on function public.sync_youth(date) to service_role;

-- ===========================================================================
-- « Je participe » et boîte à idées
-- ===========================================================================
create table public.group_event_rsvps (
  event_id uuid not null references public.group_events (id) on delete cascade,
  occurrence_date date not null,
  person_id uuid not null references public.people (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, occurrence_date, person_id)
);

create table public.group_ideas (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  author_id uuid not null references public.people (id) on delete cascade,
  body text not null check (length(trim(body)) between 3 and 1000),
  status text not null default 'open' check (status in ('open', 'retained', 'done')),
  created_at timestamptz not null default now()
);

create table public.group_idea_votes (
  idea_id uuid not null references public.group_ideas (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  primary key (idea_id, person_id)
);

alter table public.group_event_rsvps enable row level security;
alter table public.group_ideas enable row level security;
alter table public.group_idea_votes enable row level security;

create policy "Voir les participants" on public.group_event_rsvps for select to authenticated
  using (exists (select 1 from public.group_events e where e.id = event_id and private.can_see_group(e.group_id)));
create policy "Je participe" on public.group_event_rsvps for insert to authenticated
  with check (person_id = (select private.current_person_id())
              and exists (select 1 from public.group_events e where e.id = event_id and private.is_group_member(e.group_id)));
create policy "Je ne participe plus" on public.group_event_rsvps for delete to authenticated
  using (person_id = (select private.current_person_id()));

create policy "Voir les idées" on public.group_ideas for select to authenticated
  using ((select private.can_see_group(group_id)));
create policy "Proposer une idée" on public.group_ideas for insert to authenticated
  with check (author_id = (select private.current_person_id()) and (select private.is_group_member(group_id)));
create policy "Le responsable retient une idée" on public.group_ideas for update to authenticated
  using ((select private.has_permission('groups.manage', group_id)))
  with check ((select private.has_permission('groups.manage', group_id)));

create policy "Voir les votes" on public.group_idea_votes for select to authenticated
  using (exists (select 1 from public.group_ideas i where i.id = idea_id and private.can_see_group(i.group_id)));
create policy "Voter" on public.group_idea_votes for insert to authenticated
  with check (person_id = (select private.current_person_id())
              and exists (select 1 from public.group_ideas i where i.id = idea_id and private.is_group_member(i.group_id)));
create policy "Retirer son vote" on public.group_idea_votes for delete to authenticated
  using (person_id = (select private.current_person_id()));

revoke all on public.group_event_rsvps, public.group_ideas, public.group_idea_votes from anon, authenticated;
grant select, insert, delete on public.group_event_rsvps, public.group_idea_votes to authenticated;
grant select, insert on public.group_ideas to authenticated;
grant update (status) on public.group_ideas to authenticated;
grant all on public.group_event_rsvps, public.group_ideas, public.group_idea_votes to service_role;

-- ===========================================================================
-- Vue d'ensemble du pasteur
-- ===========================================================================
create or replace function public.pastor_dashboard(p_today date default current_date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  month_start date := date_trunc('month', p_today)::date;
  result jsonb := '{}'::jsonb;
  statuses text[];
begin
  if not (private.has_permission('alerts.view') or private.has_permission('cash.view')) then
    raise exception 'Réservé au pasteur et à ses assistants.' using errcode = '42501';
  end if;
  select array(select jsonb_array_elements_text(value)) into statuses from public.settings where key = 'alert_statuses';

  result := result || jsonb_build_object('members', (
    select jsonb_build_object(
      'total', count(*) filter (where status = any (coalesce(statuses, '{member}'))),
      'by_status', coalesce(jsonb_object_agg(status, n), '{}'::jsonb))
    from (select status, count(*) as n from public.people where deleted_at is null and not is_demo group by status) s));

  result := result || jsonb_build_object('attendance', (
    select coalesce(jsonb_agg(jsonb_build_object('date', s.session_date, 'title', s.title, 'present', s.n) order by s.session_date), '[]'::jsonb)
    from (select se.session_date, se.title, (select count(*) from public.attendance a where a.session_id = se.id) as n
          from public.sessions se where se.group_id is null and se.counts_for_alerts and not se.is_demo
          order by se.session_date desc limit 8) s));

  if private.has_permission('alerts.view') then
    result := result || jsonb_build_object('alerts', (
      select coalesce(jsonb_agg(jsonb_build_object('family', f.name, 'attention', f.a, 'urgent', f.u, 'critical', f.c, 'lost', f.l) order by f.u + f.c + f.l desc, f.name), '[]'::jsonb)
      from (
        select coalesce(g.name, 'Sans famille') as name,
               count(*) filter (where al.level = 'attention') as a,
               count(*) filter (where al.level = 'urgent') as u,
               count(*) filter (where al.level = 'critical') as c,
               count(*) filter (where al.level = 'lost') as l
        from public.alerts al
        join public.people p on p.id = al.person_id and not p.is_demo
        left join public.group_memberships gm on gm.person_id = al.person_id and gm.end_date is null
          and gm.group_id in (select g2.id from public.groups g2 join public.group_types t on t.id = g2.type_id and t.slug = 'family')
        left join public.groups g on g.id = gm.group_id
        where al.level <> 'ok'
        group by g.name) f));

    result := result || jsonb_build_object('souls', (
      select jsonb_build_object(
        'open', count(*),
        'new_this_month', count(*) filter (where p.arrived_at >= month_start),
        'without_family', count(*) filter (where not exists (
          select 1 from public.group_memberships gm join public.groups g on g.id = gm.group_id
          join public.group_types t on t.id = g.type_id and t.slug = 'family'
          where gm.person_id = p.id and gm.end_date is null)))
      from public.people p
      where p.deleted_at is null and not p.is_demo
        and p.status in (select jsonb_array_elements_text(value) from public.settings where key = 'soul_statuses')));

    result := result || jsonb_build_object('cells', (
      select coalesce(jsonb_agg(jsonb_build_object('name', g.name, 'last_report', r.meeting_date, 'present', r.present_count) order by g.name), '[]'::jsonb)
      from public.groups g
      join public.group_capabilities gc on gc.group_id = g.id and gc.capability_code = 'activity_reports'
      left join lateral (select meeting_date, present_count from public.group_reports x where x.group_id = g.id order by meeting_date desc limit 1) r on true
      where g.active and g.deleted_at is null and not g.is_demo));

    result := result || jsonb_build_object('life_events', (
      select count(*) from public.life_events le join public.people p on p.id = le.person_id and not p.is_demo where le.status = 'open'));

    result := result || jsonb_build_object('audiences', (
      select coalesce(jsonb_agg(jsonb_build_object('at', a.starts_at, 'status', a.status, 'name', p.first_name || ' ' || p.last_name) order by a.starts_at), '[]'::jsonb)
      from public.appointments a join public.people p on p.id = a.person_id
      where a.starts_at >= p_today and a.starts_at < p_today + 8 and a.status in ('requested', 'confirmed')));
  end if;

  if private.has_permission('cash.view') then
    result := result || jsonb_build_object('finances', (
      select jsonb_build_object(
        'income', coalesce(sum(amount) filter (where direction = 'in'), 0),
        'expense', coalesce(sum(amount) filter (where direction = 'out'), 0),
        'pending', (select count(*) from public.cash_operations where status in ('pending', 'awaiting_pastor')))
      from public.cash_operations where status = 'approved' and op_date >= month_start and op_date <= p_today));
    result := result || jsonb_build_object('pledges', (
      select jsonb_build_object(
        'promised', coalesce(sum(p.amount), 0),
        'paid', coalesce(sum((select coalesce(sum(o.amount), 0) from public.cash_operations o where o.pledge_id = p.id and o.status = 'approved')), 0))
      from public.pledges p join public.campaigns c on c.id = p.campaign_id and c.status = 'open'));
  end if;
  return result;
end;
$$;

revoke all on function public.pastor_dashboard(date) from public, anon;
grant execute on function public.pastor_dashboard(date) to authenticated;

insert into public.modules (code, label, description, icon, href, enabled, home_position, nav_position, required_permissions, required_scope) values
  ('dashboard', 'Vue d''ensemble', 'Effectif, présences, alertes, âmes, cellules, finances, engagements, audiences', 'layout-dashboard', '/tableau-de-bord', true, null, null, '{alerts.view,cash.view}', 'church')
on conflict (code) do update set enabled = true, href = excluded.href, required_permissions = excluded.required_permissions, required_scope = excluded.required_scope;
