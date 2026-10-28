-- Lot 2 — Programme des cultes : modérateurs et prédicateurs (docs/01 §10.1-10.2, docs/02 §4.3, §6.2).
--
-- services           : un culte daté (récurrent ou exceptionnel : veillée, croisade…)
-- service_positions  : les postes d'un culte (modérateur, prédicateur, louange…) et qui les tient
-- speaker_pools      : viviers (qui peut tenir quel poste, le dimanche, en semaine ou les deux)
-- unavailabilities   : indisponibilités déclarées (respectées par la génération)
-- swap_requests      : échanges de tour, validés par le chargé du programme
--
-- Le programme est généré (roulement équitable, logique dans src/lib/program.ts),
-- ajusté à la main, puis publié : les fidèles ne voient que les cultes publiés.
-- Les postes et le texte sont paramétrables (service_types.positions, settings).

insert into public.permissions (code, label, description, position) values
  ('program.manage', 'Préparer le programme des cultes', 'Viviers, génération, modifications et publication du programme', 14)
on conflict (code) do nothing;

-- Choix prudent (à confirmer) : le chargé du programme, le pasteur et l'assistant pasteur préparent le programme.
update public.roles set permissions = array(select distinct unnest(permissions || '{program.manage}'))
where code in ('program_manager', 'pastor', 'assistant_pastor');

insert into public.settings (key, value, label, is_public) values
  ('program_positions', '["Modérateur", "Prédicateur"]',
   'Postes répartis par le programme (les autres postes sont tenus par les équipes)', false),
  ('program_reminder_days', '[3, 1]', 'Rappels envoyés avant un passage (jours)', false)
on conflict (key) do nothing;

insert into public.message_templates (code, label, body) values
  ('program_reminder', 'Rappel de passage',
   'Bonjour {prénom}, rappel : vous êtes {poste} au {culte} du {date}. Que le Seigneur vous fortifie.')
on conflict (code) do nothing;

-- ===========================================================================
-- Cultes datés
-- ===========================================================================
create table public.services (
  id uuid primary key default gen_random_uuid(),
  service_type_id uuid references public.service_types (id) on delete set null,
  title text not null,
  service_date date not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  place text,
  theme text,                          -- thème général du culte (facultatif)
  exceptional boolean not null default false,
  published_at timestamptz,            -- null = brouillon, visible du seul chargé du programme
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create unique index services_type_day_uniq on public.services (service_type_id, service_date)
  where service_type_id is not null and not exceptional;
create index services_date_idx on public.services (service_date);

create table public.service_positions (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  position text not null,              -- libellé du poste (service_types.positions)
  rank smallint not null default 0,    -- ordre d'affichage
  person_id uuid references public.people (id) on delete set null,
  theme text,                          -- thème du prédicateur
  bible_text text,                     -- texte biblique
  assigned_by text not null default 'manual' check (assigned_by in ('auto', 'manual')),
  updated_at timestamptz not null default now(),
  unique (service_id, position)
);

create index service_positions_person_idx on public.service_positions (person_id);

create table public.speaker_pools (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  position text not null,
  -- 'sunday' : dimanche seulement ; 'weekday' : semaine seulement ; 'both' : les deux
  days text not null default 'both' check (days in ('sunday', 'weekday', 'both')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (person_id, position)
);

create table public.unavailabilities (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  reason text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  check (ends_on >= starts_on)
);

create index unavailabilities_person_idx on public.unavailabilities (person_id, ends_on);

create table public.swap_requests (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null references public.service_positions (id) on delete cascade,
  requester_id uuid not null references public.people (id) on delete cascade,
  replacement_id uuid not null references public.people (id) on delete cascade,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'refused', 'cancelled')),
  decided_by uuid references public.people (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index swap_requests_pending_idx on public.swap_requests (status) where status = 'pending';

create trigger services_updated_at before update on public.services
  for each row execute function public.set_updated_at();
create trigger service_positions_updated_at before update on public.service_positions
  for each row execute function public.set_updated_at();

do $$
declare t text;
begin
  foreach t in array array['services', 'service_positions', 'speaker_pools', 'unavailabilities', 'swap_requests'] loop
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
alter table public.services enable row level security;
alter table public.service_positions enable row level security;
alter table public.speaker_pools enable row level security;
alter table public.unavailabilities enable row level security;
alter table public.swap_requests enable row level security;

create policy "Voir les cultes publiés" on public.services for select to authenticated
  using (published_at is not null or (select private.has_permission('program.manage')));
create policy "Préparer les cultes" on public.services for all to authenticated
  using ((select private.has_permission('program.manage')))
  with check ((select private.has_permission('program.manage')));

create policy "Voir les postes des cultes publiés" on public.service_positions for select to authenticated
  using (
    (select private.has_permission('program.manage'))
    or exists (select 1 from public.services s where s.id = service_id and s.published_at is not null)
  );
create policy "Préparer les postes" on public.service_positions for all to authenticated
  using ((select private.has_permission('program.manage')))
  with check ((select private.has_permission('program.manage')));

create policy "Voir les viviers" on public.speaker_pools for select to authenticated
  using (person_id = (select private.current_person_id()) or (select private.has_permission('program.manage')));
create policy "Gérer les viviers" on public.speaker_pools for all to authenticated
  using ((select private.has_permission('program.manage')))
  with check ((select private.has_permission('program.manage')));

create policy "Voir les indisponibilités" on public.unavailabilities for select to authenticated
  using (person_id = (select private.current_person_id()) or (select private.has_permission('program.manage')));
create policy "Déclarer une indisponibilité" on public.unavailabilities for insert to authenticated
  with check (person_id = (select private.current_person_id()) or (select private.has_permission('program.manage')));
create policy "Retirer une indisponibilité" on public.unavailabilities for delete to authenticated
  using (person_id = (select private.current_person_id()) or (select private.has_permission('program.manage')));

create policy "Voir les échanges" on public.swap_requests for select to authenticated
  using (
    requester_id = (select private.current_person_id())
    or replacement_id = (select private.current_person_id())
    or (select private.has_permission('program.manage'))
  );
-- La décision passe par decide_swap (met aussi le poste à jour).
create policy "Annuler sa demande" on public.swap_requests for update to authenticated
  using (requester_id = (select private.current_person_id()) and status = 'pending')
  with check (requester_id = (select private.current_person_id()) and status = 'cancelled');

revoke all on public.services, public.service_positions, public.speaker_pools, public.unavailabilities, public.swap_requests
  from anon, authenticated;
grant select, insert, update, delete on public.services, public.service_positions, public.speaker_pools to authenticated;
grant select, insert, delete on public.unavailabilities to authenticated;
grant select, update on public.swap_requests to authenticated;
grant all on public.services, public.service_positions, public.speaker_pools, public.unavailabilities, public.swap_requests
  to service_role;

-- ===========================================================================
-- Lecture du programme avec les noms (les fiches restent protégées : seuls
-- prénom et nom des personnes programmées sont exposés).
-- ===========================================================================
create or replace function public.program_view(p_from date, p_to date)
returns table (
  service_id uuid, service_date date, starts_at timestamptz, title text, place text, theme text,
  exceptional boolean, published boolean,
  position_id uuid, "position" text, rank smallint, person_id uuid, person_name text,
  position_theme text, bible_text text
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.service_date, s.starts_at, s.title, s.place, s.theme, s.exceptional, s.published_at is not null,
         sp.id, sp.position, sp.rank, sp.person_id,
         case when p.id is null then null else p.last_name || ' ' || p.first_name end,
         sp.theme, sp.bible_text
  from public.services s
  left join public.service_positions sp on sp.service_id = s.id
  left join public.people p on p.id = sp.person_id and p.deleted_at is null
  where s.service_date between p_from and p_to
    and (s.published_at is not null or private.has_permission('program.manage'))
  order by s.service_date, s.starts_at, sp.rank;
$$;

revoke all on function public.program_view(date, date) from public, anon;
grant execute on function public.program_view(date, date) to authenticated;

-- Le prédicateur (ou toute personne programmée) renseigne son thème et son texte biblique.
create or replace function public.set_my_position_details(p_position uuid, p_theme text, p_bible_text text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.service_positions
  set theme = nullif(trim(p_theme), ''), bible_text = nullif(trim(p_bible_text), '')
  where id = p_position
    and (person_id = private.current_person_id() or private.has_permission('program.manage'));
  if not found then
    raise exception 'Ce passage ne vous est pas attribué.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.set_my_position_details(uuid, text, text) from public, anon;
grant execute on function public.set_my_position_details(uuid, text, text) to authenticated;

-- Demande d'échange : seule la personne programmée la fait, vers un membre du même vivier.
create or replace function public.request_swap(p_position uuid, p_replacement uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.current_person_id();
  pos public.service_positions;
  new_id uuid;
begin
  select * into pos from public.service_positions where id = p_position;
  if pos.id is null or pos.person_id is distinct from me then
    raise exception 'Ce passage ne vous est pas attribué.' using errcode = '42501';
  end if;
  if p_replacement = me then
    raise exception 'Choisissez une autre personne.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.speaker_pools where person_id = p_replacement and position = pos.position) then
    raise exception 'Cette personne ne fait pas partie du vivier de ce poste.' using errcode = 'P0001';
  end if;
  update public.swap_requests set status = 'cancelled' where position_id = p_position and status = 'pending';
  insert into public.swap_requests (position_id, requester_id, replacement_id, reason)
  values (p_position, me, p_replacement, nullif(trim(p_reason), ''))
  returning id into new_id;

  insert into public.notifications (person_id, title, body, link, kind)
  select ra.person_id, 'Demande d''échange de tour',
         (select first_name || ' ' || last_name from public.people where id = me) || ' demande un échange pour un passage.',
         '/cultes/programme', 'program'
  from public.role_assignments ra join public.roles r on r.id = ra.role_id
  where r.code = 'program_manager' and ra.scope_type = 'church'
    and ra.start_date <= current_date and (ra.end_date is null or ra.end_date >= current_date);
  return new_id;
end;
$$;

revoke all on function public.request_swap(uuid, uuid, text) from public, anon;
grant execute on function public.request_swap(uuid, uuid, text) to authenticated;

-- Le chargé du programme accepte (le poste change de titulaire) ou refuse.
create or replace function public.decide_swap(p_request uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  req public.swap_requests;
  label text;
begin
  if not private.has_permission('program.manage') then
    raise exception 'Réservé au chargé du programme.' using errcode = '42501';
  end if;
  select * into req from public.swap_requests where id = p_request and status = 'pending' for update;
  if req.id is null then
    raise exception 'Cette demande a déjà été traitée.' using errcode = 'P0001';
  end if;
  update public.swap_requests
  set status = case when p_approve then 'approved' else 'refused' end,
      decided_by = private.current_person_id(), decided_at = now()
  where id = p_request;

  select sp.position || ' · ' || s.title || ' du ' || to_char(s.service_date, 'DD/MM') into label
  from public.service_positions sp join public.services s on s.id = sp.service_id where sp.id = req.position_id;

  if p_approve then
    update public.service_positions
    set person_id = req.replacement_id, assigned_by = 'manual', theme = null, bible_text = null
    where id = req.position_id;
    insert into public.notifications (person_id, title, body, link, kind) values
      (req.requester_id, 'Échange accepté', label || ' : vous êtes remplacé(e).', '/mon-espace', 'program'),
      (req.replacement_id, 'Nouveau passage', label || ' : ce passage vous est confié.', '/mon-espace', 'program');
  else
    insert into public.notifications (person_id, title, body, link, kind) values
      (req.requester_id, 'Échange refusé', label || ' : le passage reste le vôtre.', '/mon-espace', 'program');
  end if;
end;
$$;

revoke all on function public.decide_swap(uuid, boolean) from public, anon;
grant execute on function public.decide_swap(uuid, boolean) to authenticated;

-- Publication : rend visibles les cultes de la période et prévient chaque personne programmée.
create or replace function public.publish_program(p_from date, p_to date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  if not private.has_permission('program.manage') then
    raise exception 'Réservé au chargé du programme.' using errcode = '42501';
  end if;
  with published as (
    update public.services set published_at = now()
    where service_date between p_from and p_to and published_at is null
    returning id
  )
  select count(*) into n from published;

  insert into public.notifications (person_id, title, body, link, kind)
  select sp.person_id, 'Programme des cultes publié',
         count(*) || ' passage' || case when count(*) > 1 then 's' else '' end
           || ' vous ' || case when count(*) > 1 then 'sont confiés' else 'est confié' end
           || ' du ' || to_char(p_from, 'DD/MM') || ' au ' || to_char(p_to, 'DD/MM/YYYY') || '.',
         '/mon-espace', 'program'
  from public.service_positions sp
  join public.services s on s.id = sp.service_id
  where s.service_date between p_from and p_to and sp.person_id is not null
  group by sp.person_id;
  return n;
end;
$$;

revoke all on function public.publish_program(date, date) from public, anon;
grant execute on function public.publish_program(date, date) to authenticated;

-- Rappels J-3 et J-1 (cron quotidien, serveur seulement).
create or replace function public.notify_program_reminders(p_today date default current_date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
  days integer[];
  tpl text;
begin
  select array(select jsonb_array_elements_text(value)::integer) into days
  from public.settings where key = 'program_reminder_days';
  select body into tpl from public.message_templates where code = 'program_reminder';
  insert into public.notifications (person_id, title, body, link, kind)
  select sp.person_id,
         case when s.service_date - p_today = 1 then 'Demain : ' else 'Dans ' || (s.service_date - p_today) || ' jours : ' end
           || sp.position,
         replace(replace(replace(replace(coalesce(tpl, '{poste} au {culte} du {date}'),
           '{prénom}', p.first_name), '{poste}', lower(sp.position)), '{culte}', s.title),
           '{date}', to_char(s.service_date, 'DD/MM')),
         '/mon-espace', 'program'
  from public.service_positions sp
  join public.services s on s.id = sp.service_id
  join public.people p on p.id = sp.person_id
  where s.published_at is not null
    and (s.service_date - p_today) = any (coalesce(days, '{3,1}'));
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.notify_program_reminders(date) from public, anon, authenticated;
grant execute on function public.notify_program_reminders(date) to service_role;

-- Le module « Cultes » de l'accueil devient actif.
update public.modules set enabled = true, label = 'Cultes', href = '/cultes' where code = 'services';
