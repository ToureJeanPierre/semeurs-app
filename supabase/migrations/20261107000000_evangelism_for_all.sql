-- Évangélisation ouverte à tous (demande de Jean-Pierre du 07/11/2026) : chaque fidèle peut noter
-- la personne à qui il a parlé de Jésus-Christ, la rappeler et l'inviter. L'équipe d'évangélisation
-- (et le responsable des âmes) voit toutes ces personnes pour les appeler à son tour.

-- Chacun voit les personnes qu'il a rencontrées ; l'équipe les voit toutes.
drop policy if exists "Voir les contacts terrain" on public.outreach_contacts;
create policy "Voir les contacts terrain" on public.outreach_contacts for select to authenticated
  using ((select private.is_evangelist()) or (select private.in_outing_team(outing_id))
         or met_by = (select private.current_person_id()));
drop policy if exists "Voir les sorties" on public.outreach_outings;
create policy "Voir les sorties" on public.outreach_outings for select to authenticated
  using ((select private.is_evangelist()) or (select private.in_outing_team(id))
         or exists (select 1 from public.outreach_contacts c where c.outing_id = id and c.met_by = (select private.current_person_id())));

-- Saisie : tout fidèle qui a un compte. La sortie du jour (même lieu) est reprise ou créée.
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
  if me is null then
    raise exception 'Connectez-vous pour enregistrer une personne.' using errcode = '42501';
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

-- « Invité(e) » : par l'équipe, ou par celui qui a rencontré la personne.
create or replace function public.mark_outreach_invited(p_contact uuid, p_invited boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (private.is_evangelist()
          or exists (select 1 from public.outreach_contacts c where c.id = p_contact and c.met_by = private.current_person_id())) then
    raise exception 'Seuls l''équipe d''évangélisation et celui qui a rencontré la personne peuvent le noter.' using errcode = '42501';
  end if;
  update public.outreach_contacts
  set invited_on = case when p_invited then current_date end,
      invited_by = case when p_invited then private.current_person_id() end
  where id = p_contact;
end;
$$;

-- Une personne notée par un fidèle : l'équipe d'évangélisation est prévenue pour l'appeler à son tour.
create or replace function private.notify_outreach_contact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare who text;
begin
  select first_name || ' ' || last_name into who from public.people where id = new.met_by;
  insert into public.notifications (person_id, title, body, link, kind)
  select distinct gm.person_id, 'Nouvelle personne à suivre',
         new.first_name || ' ' || new.last_name || coalesce(' (' || new.district || ')', '') || coalesce(', rencontré(e) par ' || who, '') || '.',
         '/evangelisation', 'outreach'
  from public.group_memberships gm
  join public.group_capabilities gc on gc.group_id = gm.group_id and gc.capability_code = 'evangelism'
  where gm.end_date is null and gm.person_id is distinct from new.met_by;
  return new;
end;
$$;

drop trigger if exists outreach_contacts_notify on public.outreach_contacts;
create trigger outreach_contacts_notify after insert on public.outreach_contacts
  for each row execute function private.notify_outreach_contact();

-- L'onglet est visible de tous les fidèles.
update public.modules set required_permissions = '{}', required_scope = 'any',
  description = 'Chacun peut évangéliser : noter la personne, l''appeler, l''inviter au culte'
where code = 'evangelism';
