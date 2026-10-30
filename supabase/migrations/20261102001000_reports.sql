-- Bilans imprimables (demande de Jean-Pierre du 30/10/2026) : activité et finances,
-- pour un mois ou une année (toute période en fait), réservés au pasteur et à ceux qu'il désigne.

insert into public.permissions (code, label, description, position) values
  ('reports.view', 'Voir les bilans', 'Bilans d''activité (et financiers avec le droit caisse) du mois ou de l''année', 30)
on conflict (code) do nothing;

update public.roles set permissions = array(select distinct unnest(permissions || '{reports.view}'))
where code in ('pastor', 'assistant_pastor', 'admin');

insert into public.modules (code, label, description, icon, href, enabled, home_position, nav_position, required_permissions, required_scope,
                            hero_title, verse_text, verse_ref)
values ('reports', 'Bilans', 'Bilan d''activité et bilan financier du mois ou de l''année, à imprimer', 'clipboard-list', '/bilans', true, null, null,
        '{reports.view}', 'church', 'Rendre compte avec joie',
        'Que tout se fasse avec bienséance et avec ordre.', '1 Corinthiens 14:40')
on conflict (code) do update set enabled = true, href = excluded.href, required_permissions = excluded.required_permissions,
  required_scope = excluded.required_scope;

-- Bilan d'activité : chiffres de la période et activités programmées.
create or replace function public.activity_report(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  souls text[];
  r jsonb;
begin
  if not private.has_permission('reports.view') then
    raise exception 'Réservé au pasteur et aux responsables désignés.' using errcode = '42501';
  end if;
  select array(select jsonb_array_elements_text(value)) into souls from public.settings where key = 'soul_statuses';

  select jsonb_build_object(
    'worship', (
      select jsonb_build_object(
        'sessions', count(*),
        'attendance', coalesce(sum(n), 0),
        'average', coalesce(round(avg(n)), 0),
        'list', coalesce(jsonb_agg(jsonb_build_object('date', session_date, 'title', title, 'present', n) order by session_date), '[]'::jsonb))
      from (
        select s.session_date, s.title, (select count(*) from public.attendance a where a.session_id = s.id) n
        from public.sessions s
        where s.group_id is null and s.session_date between p_from and p_to and not s.is_demo
      ) x),
    'groups', jsonb_build_object(
      'sessions', (select count(*) from public.sessions s where s.group_id is not null and s.session_date between p_from and p_to and not s.is_demo),
      'reports', (select count(*) from public.group_reports g where g.meeting_date between p_from and p_to),
      'present', (select coalesce(sum(present_count), 0) from public.group_reports g where g.meeting_date between p_from and p_to),
      'newcomers', (select coalesce(sum(newcomers_count), 0) from public.group_reports g where g.meeting_date between p_from and p_to)),
    'souls', jsonb_build_object(
      'arrived', (select count(*) from public.people p where p.deleted_at is null and not p.is_demo and p.arrived_at between p_from and p_to),
      'still_following', (select count(*) from public.people p where p.deleted_at is null and not p.is_demo and p.status = any (souls)),
      'integrated', (select count(*) from public.person_steps ps join public.integration_steps st on st.id = ps.step_id
                     where st.code = 'family' and ps.done_on between p_from and p_to)),
    'outreach', jsonb_build_object(
      'outings', (select count(*) from public.outreach_outings o where o.outing_date between p_from and p_to),
      'contacts', (select count(*) from public.outreach_contacts c join public.outreach_outings o on o.id = c.outing_id where o.outing_date between p_from and p_to),
      'accepted', (select count(*) from public.outreach_contacts c join public.outreach_outings o on o.id = c.outing_id
                   where o.outing_date between p_from and p_to and c.decision = 'accepted'),
      'came', (select count(*) from public.outreach_contacts c join public.outreach_outings o on o.id = c.outing_id
               where o.outing_date between p_from and p_to and c.person_id is not null)),
    'care', jsonb_build_object(
      'follow_ups', (select count(*) from public.follow_ups f where f.created_at::date between p_from and p_to),
      'audiences', (select count(*) from public.appointments a where a.starts_at::date between p_from and p_to and a.status <> 'cancelled'),
      'life_events', (select coalesce(jsonb_object_agg(kind, n), '{}'::jsonb) from (
                        select kind, count(*) n from public.life_events where event_date between p_from and p_to group by kind) k),
      'alerts_now', (select count(*) from public.alerts al where al.level in ('urgent', 'critical'))),
    'meetings', (select jsonb_build_object(
                   'held', count(*) filter (where status = 'held'),
                   'planned', count(*) filter (where status = 'planned'),
                   'cancelled', count(*) filter (where status = 'cancelled'))
                 from public.meetings m where m.starts_at::date between p_from and p_to),
    'trainings', jsonb_build_object(
      'enrolled', (select count(*) from public.training_enrollments e where e.enrolled_on between p_from and p_to),
      'completed', (select count(*) from public.training_enrollments e where e.completed_on between p_from and p_to)),
    'acts', (select coalesce(jsonb_object_agg(kind, n), '{}'::jsonb) from (
               select kind, count(*) n from public.acts where act_date between p_from and p_to group by kind) a),
    'messages', (select count(*) from public.broadcasts b where b.created_at::date between p_from and p_to),
    'contributions', (select coalesce(sum(amount), 0) from public.contribution_payments cp
                      where cp.status = 'validated' and cp.validated_at::date between p_from and p_to),
    'programme', jsonb_build_object(
      'services', (select coalesce(jsonb_agg(jsonb_build_object('date', service_date, 'title', title) order by service_date), '[]'::jsonb)
                   from public.services s where s.service_date between p_from and p_to and s.published_at is not null),
      'events', (select coalesce(jsonb_agg(jsonb_build_object('date', starts_at::date, 'title', title,
                   'registered', (select count(*) from public.event_registrations er where er.event_id = e.id)) order by starts_at), '[]'::jsonb)
                 from public.church_events e where e.starts_at::date between p_from and p_to),
      'meetings', (select coalesce(jsonb_agg(jsonb_build_object('date', starts_at::date, 'title', title, 'status', status) order by starts_at), '[]'::jsonb)
                   from public.meetings m where m.starts_at::date between p_from and p_to))
  ) into r;
  return r;
end;
$$;

revoke all on function public.activity_report(date, date) from public, anon;
grant execute on function public.activity_report(date, date) to authenticated;

-- Bilan financier : recettes et dépenses validées par catégorie, soldes début et fin de période.
create or replace function public.finance_report(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare r jsonb;
begin
  if not (private.has_permission('cash.view') or private.has_permission('cash.approve') or private.has_permission('cash.manage')) then
    raise exception 'Réservé à la caisse et au pasteur.' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'opening', (select coalesce(sum(case when direction = 'in' then amount else -amount end), 0)
                from public.cash_operations where status = 'approved' and op_date < p_from),
    'closing', (select coalesce(sum(case when direction = 'in' then amount else -amount end), 0)
                from public.cash_operations where status = 'approved' and op_date <= p_to),
    'income', (select coalesce(jsonb_agg(jsonb_build_object('category', category, 'amount', total) order by total desc), '[]'::jsonb)
               from (select category, sum(amount) total from public.cash_operations
                     where status = 'approved' and direction = 'in' and op_date between p_from and p_to group by category) i),
    'expense', (select coalesce(jsonb_agg(jsonb_build_object('category', category, 'amount', total) order by total desc), '[]'::jsonb)
                from (select category, sum(amount) total from public.cash_operations
                      where status = 'approved' and direction = 'out' and op_date between p_from and p_to group by category) e),
    'pending', (select count(*) from public.cash_operations where status in ('pending', 'awaiting_pastor') and op_date between p_from and p_to),
    'contributions', (select coalesce(sum(amount), 0) from public.contribution_payments cp
                      where cp.status = 'validated' and cp.validated_at::date between p_from and p_to)
  ) into r;
  return r;
end;
$$;

revoke all on function public.finance_report(date, date) from public, anon;
grant execute on function public.finance_report(date, date) to authenticated;
