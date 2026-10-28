-- Cotisations : le suivi renvoie aussi le prénom (messages de relance personnalisés).
drop function public.contribution_status(uuid, text);

create or replace function public.contribution_status(p_heading uuid, p_period text default null)
returns table (person_id uuid, name text, first_name text, phone text, expected integer, paid integer, declared integer, state text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  h public.contribution_headings;
  statuses text[];
begin
  select * into h from public.contribution_headings where id = p_heading;
  if h.id is null or not private.can_follow_heading(h.group_id) then
    raise exception 'Réservé à qui suit cette cotisation.' using errcode = '42501';
  end if;
  select array(select jsonb_array_elements_text(value)) into statuses from public.settings where key = 'alert_statuses';

  return query
  with expected_people as (
    select p.id, p.first_name, p.last_name, coalesce(p.whatsapp, p.phone) as phone
    from public.people p
    where p.deleted_at is null
      and (
        (h.group_id is not null and exists (
          select 1 from public.group_memberships gm where gm.group_id = h.group_id and gm.person_id = p.id and gm.end_date is null))
        or (h.group_id is null and p.status = any (coalesce(statuses, '{member}')))
      )
      and p.id is distinct from h.beneficiary_id
  ),
  sums as (
    select cp.person_id,
           coalesce(sum(cp.amount) filter (where cp.status = 'validated'), 0)::integer as paid,
           coalesce(sum(cp.amount) filter (where cp.status = 'declared'), 0)::integer as declared
    from public.contribution_payments cp
    where cp.heading_id = h.id
      and (h.recurrence <> 'monthly' or cp.period = coalesce(p_period, to_char(current_date, 'YYYY-MM')))
    group by cp.person_id
  )
  select e.id, e.last_name || ' ' || e.first_name, e.first_name, e.phone, h.amount,
         coalesce(s.paid, 0), coalesce(s.declared, 0),
         case
           when coalesce(s.paid, 0) <= 0 then 'unpaid'
           when h.amount_mode = 'fixed' and s.paid < h.amount then 'partial'
           else 'paid'
         end
  from expected_people e
  left join sums s on s.person_id = e.id
  order by e.last_name, e.first_name;
end;
$$;

revoke all on function public.contribution_status(uuid, text) from public, anon;
grant execute on function public.contribution_status(uuid, text) to authenticated;

create or replace function public.remind_contribution(p_heading uuid, p_period text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  h public.contribution_headings;
  tpl text;
  n integer;
begin
  select * into h from public.contribution_headings where id = p_heading;
  if h.id is null or not private.can_manage_heading(h.group_id) then
    raise exception 'Réservé à qui gère cette cotisation.' using errcode = '42501';
  end if;
  select body into tpl from public.message_templates where code = 'contribution_reminder';
  insert into public.notifications (person_id, title, body, link, kind)
  select s.person_id, 'Rappel : ' || h.title,
         replace(replace(coalesce(tpl, 'Rappel pour la cotisation « {cotisation} ».'), '{prénom}', p.first_name), '{cotisation}', h.title),
         '/cotisations', 'contribution'
  from public.contribution_status(p_heading, p_period) s
  join public.people p on p.id = s.person_id
  where s.state <> 'paid';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.remind_contribution(uuid, text) from public, anon;
grant execute on function public.remind_contribution(uuid, text) to authenticated;
