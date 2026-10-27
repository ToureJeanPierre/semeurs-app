-- Données de démonstration (CLAUDE.md : fidèles fictifs et un compte par rôle pour la phase de test).
--
-- Elles sont marquées « is_demo » pour ne jamais se mêler aux données réelles :
-- les cultes de démonstration ne comptent que pour les fidèles de démonstration
-- (et inversement), et tout pourra être effacé d'un coup avant le lancement.

alter table public.people add column is_demo boolean not null default false;
alter table public.groups add column is_demo boolean not null default false;
alter table public.sessions add column is_demo boolean not null default false;

comment on column public.people.is_demo is 'Fidèle fictif créé pour les essais (scripts/seed-demo.mjs).';

-- Calcul des alertes : un culte de démonstration ne compte que pour les fidèles de démonstration.
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
             where a.person_id = p.id and s.counts_for_alerts and (not p.weekday_exempt or s.is_sunday_service)
               and s.is_demo = p.is_demo) as last_presence,
           p.is_demo
    from public.people p
    where p.deleted_at is null and p.status = any (statuses)
  loop
    ref := coalesce(r.last_presence, r.since);
    -- Un culte (qui compte pour lui) a-t-il eu lieu depuis ?
    select exists (
      select 1 from public.sessions s
      where s.counts_for_alerts and s.session_date > ref and s.session_date <= p_today
        and (not r.weekday_exempt or s.is_sunday_service)
        and s.is_demo = r.is_demo
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
