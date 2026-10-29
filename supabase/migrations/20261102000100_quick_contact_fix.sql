-- Correctif : variable « zone » ambiguë avec la colonne du même nom (révélé par le test RLS).
create or replace function public.quick_outreach_contact(
  p_first_name text, p_last_name text, p_phone text, p_district text, p_decision text, p_note text, p_zone text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.current_person_id();
  grp uuid;
  outing uuid;
  v_zone text := coalesce(nullif(trim(p_zone), ''), nullif(trim(p_district), ''), 'Évangélisation');
  contact uuid;
begin
  if me is null or not private.is_evangelist() then
    raise exception 'Réservé à l''équipe d''évangélisation.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_first_name, ''))) < 1 or length(trim(coalesce(p_last_name, ''))) < 1 then
    raise exception 'Nom et prénom obligatoires.' using errcode = 'P0001';
  end if;
  select g into grp from private.evangelism_groups() g limit 1;
  select o.id into outing from public.outreach_outings o
  where o.outing_date = current_date and lower(o.zone) = lower(v_zone)
  order by o.created_at limit 1;
  if outing is null then
    insert into public.outreach_outings (zone, group_id, created_by)
    values (v_zone, grp, auth.uid()) returning id into outing;
  end if;
  insert into public.outreach_contacts (outing_id, first_name, last_name, phone, district, decision, note, met_by)
  values (outing, trim(p_first_name), trim(p_last_name), nullif(p_phone, ''), nullif(trim(p_district), ''),
          coalesce(nullif(p_decision, ''), 'interested'), nullif(trim(p_note), ''), me)
  returning id into contact;
  return contact;
end;
$$;

