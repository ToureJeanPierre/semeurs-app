-- Retours de Jean-Pierre du 29/10/2026 :
-- 1. Onglet « Évangélisation » : noter sur le terrain (nom, téléphone, quartier) et inviter la veille du culte.
--    Capacité de groupe « evangelism » : les membres d'un groupe qui la coche sont des évangélistes.
-- 2. Nouvelles âmes : leurs accompagnateurs peuvent voir le domicile et demander la position (visite).
-- 3. Supprimer un fidèle ou un groupe : archivage (deleted_at), jamais d'effacement ; historique conservé.

-- ===========================================================================
-- 1. Évangélisation
-- ===========================================================================
insert into public.capabilities (code, label, description, available, position)
values ('evangelism', 'Évangélisation', 'Les membres notent les personnes rencontrées et les invitent au culte', true, 15)
on conflict (code) do update set available = true;

-- L'équipe « Évangélisation » existante reçoit la capacité (réglable ensuite dans Administration → Groupes).
insert into public.group_capabilities (group_id, capability_code)
select g.id, 'evangelism' from public.groups g join public.group_types gt on gt.id = g.type_id
where gt.slug = 'team' and g.deleted_at is null and lower(g.name) like '%vang%lisation%'
on conflict do nothing;

create or replace function private.evangelism_groups()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select gm.group_id from public.group_memberships gm
  join public.group_capabilities gc on gc.group_id = gm.group_id and gc.capability_code = 'evangelism'
  join public.groups g on g.id = gm.group_id and g.deleted_at is null
  where gm.person_id = private.current_person_id() and gm.end_date is null;
$$;

create or replace function private.is_evangelist()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_permission('souls.manage') or exists (select 1 from private.evangelism_groups());
$$;

revoke all on function private.evangelism_groups(), private.is_evangelist() from public, anon;
grant execute on function private.evangelism_groups(), private.is_evangelist() to authenticated;

alter table public.outreach_contacts add column if not exists invited_on date;
alter table public.outreach_contacts add column if not exists invited_by uuid references public.people (id) on delete set null;

-- Les évangélistes voient tous les contacts terrain (pour inviter), pas seulement ceux de leur sortie.
drop policy if exists "Voir les contacts terrain" on public.outreach_contacts;
create policy "Voir les contacts terrain" on public.outreach_contacts for select to authenticated
  using ((select private.is_evangelist()) or (select private.in_outing_team(outing_id)));
drop policy if exists "Voir les sorties" on public.outreach_outings;
create policy "Voir les sorties" on public.outreach_outings for select to authenticated
  using ((select private.is_evangelist()) or (select private.in_outing_team(id)));

-- Saisie express sur le terrain : la sortie du jour (même lieu) est créée ou reprise automatiquement.
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
  zone text := coalesce(nullif(trim(p_zone), ''), nullif(trim(p_district), ''), 'Évangélisation');
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
  where o.outing_date = current_date and lower(o.zone) = lower(zone)
  order by o.created_at limit 1;
  if outing is null then
    insert into public.outreach_outings (zone, group_id, created_by)
    values (zone, grp, auth.uid()) returning id into outing;
  end if;
  insert into public.outreach_contacts (outing_id, first_name, last_name, phone, district, decision, note, met_by)
  values (outing, trim(p_first_name), trim(p_last_name), nullif(p_phone, ''), nullif(trim(p_district), ''),
          coalesce(nullif(p_decision, ''), 'interested'), nullif(trim(p_note), ''), me)
  returning id into contact;
  return contact;
end;
$$;

revoke all on function public.quick_outreach_contact(text, text, text, text, text, text, text) from public, anon;
grant execute on function public.quick_outreach_contact(text, text, text, text, text, text, text) to authenticated;

-- « Invité(e) » : noté pour ne pas inviter deux fois la même personne pour le même culte.
create or replace function public.mark_outreach_invited(p_contact uuid, p_invited boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_evangelist() then
    raise exception 'Réservé à l''équipe d''évangélisation.' using errcode = '42501';
  end if;
  update public.outreach_contacts
  set invited_on = case when p_invited then current_date end,
      invited_by = case when p_invited then private.current_person_id() end
  where id = p_contact;
end;
$$;

revoke all on function public.mark_outreach_invited(uuid, boolean) from public, anon;
grant execute on function public.mark_outreach_invited(uuid, boolean) to authenticated;

insert into public.message_templates (code, label, body) values
  ('outreach_invite', 'Invitation au culte (évangélisation)',
   'Bonjour {prénom}, que la paix de Dieu soit avec vous ! Nous serons heureux de vous accueillir {culte} à l''église Les Semeurs de la Parole (Yopougon, Camp Militaire, carrefour Gandhi). Que Dieu vous bénisse !')
on conflict (code) do nothing;

-- La veille d'un culte : les évangélistes sont prévenus qu'il y a des personnes à inviter.
create or replace function public.notify_outreach_invites(p_today date default current_date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
  todo integer;
  culte text;
begin
  select st.name into culte from public.service_types st
  where st.active and st.weekday = extract(dow from p_today + 1)::integer
  order by st.start_time limit 1;
  if culte is null then
    return 0;
  end if;
  select count(*) into todo from public.outreach_contacts c
  where c.phone is not null and c.person_id is null and c.created_at >= p_today - 90
    and (c.invited_on is null or c.invited_on < p_today);
  select todo + count(*) into todo from public.people p, public.settings s
  where s.key = 'soul_statuses' and p.deleted_at is null and p.phone is not null
    and p.status in (select jsonb_array_elements_text(s.value));
  if todo = 0 then
    return 0;
  end if;
  insert into public.notifications (person_id, title, body, link, kind)
  select distinct x.person_id, 'Demain : ' || culte,
         todo || ' personne' || case when todo > 1 then 's' else '' end || ' à inviter (nouvelles âmes et contacts d''évangélisation).',
         '/evangelisation', 'outreach'
  from (
    select gm.person_id from public.group_memberships gm
    join public.group_capabilities gc on gc.group_id = gm.group_id and gc.capability_code = 'evangelism'
    where gm.end_date is null
    union
    select ra.person_id from public.role_assignments ra join public.roles r on r.id = ra.role_id
    where 'souls.manage' = any (r.permissions) and ra.start_date <= p_today and (ra.end_date is null or ra.end_date >= p_today)
  ) x;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.notify_outreach_invites(date) from public, anon, authenticated;
grant execute on function public.notify_outreach_invites(date) to service_role;

-- Onglet du menu : visible des évangélistes (droit d'église, ou membre d'un groupe qui coche « Évangélisation »).
insert into public.permissions (code, label, description, position) values
  ('outreach.record', 'Évangéliser', 'Noter les personnes rencontrées et les inviter au culte', 29)
on conflict (code) do nothing;
update public.roles set permissions = array(select distinct unnest(permissions || '{outreach.record}'))
where code in ('pastor', 'assistant_pastor', 'evangelism_lead');

-- my_access : tout membre d'un groupe « Évangélisation » détient le droit de groupe outreach.record.
create or replace function public.my_access()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  with me as (select private.current_person_id() as person_id)
  select jsonb_build_object(
    'person_id', (select person_id from me),
    'church_permissions', coalesce((
      select jsonb_agg(distinct p)
      from public.role_assignments ra
      join public.roles r on r.id = ra.role_id
      cross join lateral unnest(r.permissions) as p
      where ra.person_id = (select person_id from me)
        and ra.scope_type = 'church'
        and ra.start_date <= current_date
        and (ra.end_date is null or ra.end_date >= current_date)
    ), '[]'::jsonb),
    'group_permissions', coalesce((
      select jsonb_agg(distinct p)
      from (
        select unnest(f.permissions) as p
        from public.group_memberships gm
        join public.group_functions f on f.id = gm.function_id
        where gm.person_id = (select person_id from me) and gm.end_date is null
        union
        select unnest(r.permissions)
        from public.role_assignments ra
        join public.roles r on r.id = ra.role_id
        where ra.person_id = (select person_id from me)
          and ra.scope_type = 'group'
          and ra.start_date <= current_date
          and (ra.end_date is null or ra.end_date >= current_date)
        union
        -- Délégué : il voit et suit les fidèles qui lui sont confiés.
        select unnest(array['people.view', 'alerts.view', 'alerts.manage'])
        from public.delegations d
        where d.delegate_id = (select person_id from me)
          and d.start_date <= current_date
          and (d.end_date is null or d.end_date >= current_date)
        union
        -- Membre d'une équipe d'évangélisation : il note et invite sur le terrain.
        select 'outreach.record' where exists (select 1 from private.evangelism_groups())
      ) as gp
    ), '[]'::jsonb),
    'roles', coalesce((
      select jsonb_agg(distinct r.label)
      from public.role_assignments ra
      join public.roles r on r.id = ra.role_id
      where ra.person_id = (select person_id from me)
        and ra.start_date <= current_date
        and (ra.end_date is null or ra.end_date >= current_date)
    ), '[]'::jsonb)
  );
$function$;

insert into public.modules (code, label, description, icon, href, enabled, home_position, nav_position, required_permissions, required_scope)
values ('evangelism', 'Évangélisation', 'Noter les personnes rencontrées, les inviter au culte', 'footprints', '/evangelisation', true, null, null,
        '{outreach.record,souls.manage}', 'any')
on conflict (code) do update set enabled = true, href = excluded.href, label = excluded.label,
  required_permissions = excluded.required_permissions, required_scope = excluded.required_scope;

-- ===========================================================================
-- 2. Visiter les nouvelles âmes : leurs accompagnateurs voient le domicile
-- ===========================================================================
create or replace function private.follows_soul(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.people p, public.settings s
    where p.id = target and p.deleted_at is null and s.key = 'soul_statuses'
      and p.status in (select jsonb_array_elements_text(s.value))
      and (private.has_permission('souls.manage') or target in (select private.my_souls()))
  );
$$;

revoke all on function private.follows_soul(uuid) from public, anon;
grant execute on function private.follows_soul(uuid) to authenticated;

create or replace function private.can_see_home(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target = private.current_person_id()
    or private.has_permission('location.view')
    or exists (
      select 1 from public.group_memberships gm
      where gm.person_id = target and gm.end_date is null
        and gm.group_id in (select private.groups_with_permission('people.manage'))
    )
    or target in (select private.delegated_people())
    or private.follows_soul(target);
$$;

drop policy if exists "Voir les liens de position" on public.location_tokens;
create policy "Voir les liens de position" on public.location_tokens for select to authenticated
  using ((select private.can_manage_person(person_id)) or (select private.follows_soul(person_id)));
drop policy if exists "Créer un lien de position" on public.location_tokens;
create policy "Créer un lien de position" on public.location_tokens for insert to authenticated
  with check ((select private.can_manage_person(person_id)) or (select private.follows_soul(person_id)));

-- ===========================================================================
-- 3. Supprimer (archiver) un fidèle ou un groupe
-- ===========================================================================
-- Fidèle : retiré des listes et de ses groupes, accès à l'appli fermé ; ses opérations (caisse,
-- cotisations, présences) restent dans l'historique. Réservé à people.manage au niveau de l'église.
create or replace function public.archive_person(p_person uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('people.manage') then
    raise exception 'Réservé aux personnes qui gèrent les fiches de l''église.' using errcode = '42501';
  end if;
  if p_person = private.current_person_id() then
    raise exception 'Vous ne pouvez pas supprimer votre propre fiche.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Indiquez le motif.' using errcode = 'P0001';
  end if;
  update public.people set deleted_at = now() where id = p_person and deleted_at is null;
  update public.group_memberships set end_date = current_date, function_id = null where person_id = p_person and end_date is null;
  update public.role_assignments set end_date = current_date where person_id = p_person and end_date is null;
  update public.soul_assignments set end_date = current_date where (person_id = p_person or assignee_id = p_person) and end_date is null;
  delete from public.users where person_id = p_person;
  -- Le motif reste dans le journal de suivi de la fiche (lisible si la fiche est restaurée).
  insert into public.follow_ups (person_id, author_id, channel, result, note)
  values (p_person, private.current_person_id(), 'other', 'archived', 'Fiche supprimée : ' || trim(p_reason));
end;
$$;

revoke all on function public.archive_person(uuid, text) from public, anon;
grant execute on function public.archive_person(uuid, text) to authenticated;

-- Groupe (famille, équipe, cellule…) : retiré des listes, les membres en sortent ; historique conservé.
create or replace function public.archive_group(p_group uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('groups.manage') then
    raise exception 'Réservé aux administrateurs des groupes.' using errcode = '42501';
  end if;
  update public.groups set deleted_at = now() where id = p_group and deleted_at is null;
  update public.group_memberships set end_date = current_date, function_id = null where group_id = p_group and end_date is null;
end;
$$;

revoke all on function public.archive_group(uuid) from public, anon;
grant execute on function public.archive_group(uuid) to authenticated;
