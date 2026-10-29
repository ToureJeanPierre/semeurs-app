-- Lot 4 — Modules complémentaires (docs/01 §11 ; M13, M16-M20) et agenda de l'église.
--
-- sermons                      : médiathèque des prédications (audio stocké ou lien YouTube/Facebook)
-- church_events / registrations: événements de l'église (croisade, convention…) et inscriptions
-- trainings / lessons / progress : formations et parcours, progression, attestation
-- acts                         : registre des actes (baptêmes, mariages, présentations), certificats numérotés
-- person_relations             : liens (parent, enfant, conjoint, tuteur) ; école du dimanche :
--                                personnes autorisées à récupérer un enfant
-- inventory_items / movements  : inventaire du patrimoine, mouvements, rappels d'entretien
-- polls / poll_votes           : sondages ciblés, anonymes ou nominatifs

insert into public.permissions (code, label, description, position) values
  ('sermons.manage', 'Publier les prédications', 'Ajouter les prédications (audio, vidéo, notes)', 23),
  ('events.manage', 'Organiser les événements', 'Créer les événements de l''église et suivre les inscriptions', 24),
  ('trainings.manage', 'Gérer les formations', 'Créer les parcours, inscrire, valider la progression', 25),
  ('acts.manage', 'Tenir le registre des actes', 'Baptêmes, mariages, présentations d''enfants, certificats', 26),
  ('inventory.manage', 'Gérer l''inventaire', 'Biens de l''église, mouvements, entretien', 27),
  ('polls.manage', 'Lancer des sondages', 'Sondages de l''église', 28)
on conflict (code) do nothing;

update public.roles set permissions = array(select distinct unnest(permissions || '{sermons.manage,events.manage,trainings.manage,acts.manage,inventory.manage,polls.manage}')) where code = 'pastor';
update public.roles set permissions = array(select distinct unnest(permissions || '{sermons.manage,events.manage,trainings.manage,polls.manage}')) where code = 'assistant_pastor';
update public.roles set permissions = array(select distinct unnest(permissions || '{events.manage,acts.manage,inventory.manage,polls.manage}')) where code = 'admin';
update public.roles set permissions = array(select distinct unnest(permissions || '{sermons.manage,events.manage}')) where code = 'program_manager';
update public.roles set permissions = array(select distinct unnest(permissions || '{trainings.manage}')) where code = 'evangelism_lead';

update public.capabilities set available = true where code in ('trainings', 'inventory');

insert into public.value_lists (list_code, value, label, position) values
  ('event_kind', 'crusade', 'Croisade', 1),
  ('event_kind', 'convention', 'Convention', 2),
  ('event_kind', 'vigil', 'Veillée', 3),
  ('event_kind', 'conference', 'Conférence', 4),
  ('event_kind', 'outing', 'Sortie', 5),
  ('event_kind', 'fasting', 'Jeûne', 6),
  ('event_kind', 'other', 'Autre', 7),
  ('act_kind', 'baptism', 'Baptême', 1),
  ('act_kind', 'wedding', 'Mariage', 2),
  ('act_kind', 'child_presentation', 'Présentation d''enfant', 3),
  ('relation_kind', 'parent', 'Parent', 1),
  ('relation_kind', 'child', 'Enfant', 2),
  ('relation_kind', 'spouse', 'Conjoint(e)', 3),
  ('relation_kind', 'guardian', 'Tuteur, tutrice', 4),
  ('inventory_condition', 'good', 'Bon état', 1),
  ('inventory_condition', 'worn', 'Usé', 2),
  ('inventory_condition', 'broken', 'En panne', 3),
  ('inventory_movement', 'loan', 'Prêt', 1),
  ('inventory_movement', 'return', 'Retour', 2),
  ('inventory_movement', 'repair', 'Réparation', 3),
  ('inventory_movement', 'out', 'Sortie définitive', 4)
on conflict (list_code, value) do nothing;

-- ===========================================================================
-- Prédications
-- ===========================================================================
create table public.sermons (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) >= 2),
  sermon_date date not null default current_date,
  preacher_id uuid references public.people (id) on delete set null,
  preacher_name text,                   -- invité ou nom libre si pas dans le registre
  theme text,
  bible_text text,
  summary text,
  media_url text check (media_url is null or media_url ~ '^https://'),
  audio_path text,                      -- stockage « predications »
  service_id uuid references public.services (id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
create index sermons_date_idx on public.sermons (sermon_date desc);

-- ===========================================================================
-- Événements de l'église
-- ===========================================================================
create table public.church_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) >= 3),
  kind text not null default 'other',
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  place text,
  registration boolean not null default false,
  capacity integer check (capacity > 0),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
create index church_events_starts_idx on public.church_events (starts_at);

create table public.event_registrations (
  event_id uuid not null references public.church_events (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, person_id)
);

-- ===========================================================================
-- Formations
-- ===========================================================================
create table public.trainings (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) >= 3),
  description text,
  group_id uuid references public.groups (id) on delete set null,
  integration_step_code text,           -- étape du parcours d'intégration validée à la fin (ex. new_converts_course)
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create table public.training_lessons (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings (id) on delete cascade,
  position integer not null default 0,
  title text not null,
  content text,
  resource_url text check (resource_url is null or resource_url ~ '^https://')
);

create table public.training_enrollments (
  training_id uuid not null references public.trainings (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  enrolled_on date not null default current_date,
  completed_on date,
  certificate_no text unique,
  primary key (training_id, person_id)
);

create table public.lesson_progress (
  lesson_id uuid not null references public.training_lessons (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  done_on date not null default current_date,
  validated_by uuid references public.people (id) on delete set null,
  primary key (lesson_id, person_id)
);

create sequence public.training_certificate_seq;

-- ===========================================================================
-- Registre des actes
-- ===========================================================================
create sequence public.act_seq;

create table public.acts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('baptism', 'wedding', 'child_presentation')),
  act_date date not null,
  place text,
  officiant_id uuid references public.people (id) on delete set null,
  officiant_name text,
  person_ids uuid[] not null,            -- baptisé(e) ; époux et épouse ; enfant puis parents
  witnesses text,
  notes text,
  certificate_no text not null unique,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  check (array_length(person_ids, 1) >= 1)
);

-- ===========================================================================
-- Liens entre personnes (famille de sang, école du dimanche)
-- ===========================================================================
create table public.person_relations (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  related_id uuid not null references public.people (id) on delete cascade,
  relation text not null,                 -- liste « relation_kind » : ce que related_id est pour person_id
  can_pickup boolean not null default false, -- autorisé(e) à récupérer l'enfant (école du dimanche)
  created_at timestamptz not null default now(),
  unique (person_id, related_id),
  check (person_id <> related_id)
);

-- ===========================================================================
-- Inventaire
-- ===========================================================================
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) >= 2),
  category text,
  group_id uuid references public.groups (id) on delete set null,   -- groupe responsable
  quantity integer not null default 1 check (quantity >= 0),
  value integer check (value >= 0),
  condition text not null default 'good',
  location text,
  acquired_on date,
  next_maintenance_on date,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items (id) on delete cascade,
  kind text not null,
  person_id uuid references public.people (id) on delete set null,
  moved_on date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references public.people (id) on delete set null
);

-- ===========================================================================
-- Sondages
-- ===========================================================================
create table public.polls (
  id uuid primary key default gen_random_uuid(),
  question text not null check (length(trim(question)) >= 5),
  options text[] not null check (array_length(options, 1) between 2 and 10),
  group_id uuid references public.groups (id) on delete cascade,   -- null = toute l'église
  anonymous boolean not null default true,
  closes_on date,
  created_at timestamptz not null default now(),
  created_by uuid references public.people (id) on delete set null
);

create table public.poll_votes (
  poll_id uuid not null references public.polls (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  option_index integer not null check (option_index >= 0),
  created_at timestamptz not null default now(),
  primary key (poll_id, person_id)
);

do $$
declare t text;
begin
  foreach t in array array['sermons', 'church_events', 'event_registrations', 'trainings', 'training_lessons', 'training_enrollments',
                           'lesson_progress', 'acts', 'person_relations', 'inventory_items', 'inventory_movements', 'polls'] loop
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
alter table public.sermons enable row level security;
alter table public.church_events enable row level security;
alter table public.event_registrations enable row level security;
alter table public.trainings enable row level security;
alter table public.training_lessons enable row level security;
alter table public.training_enrollments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.acts enable row level security;
alter table public.person_relations enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.polls enable row level security;
alter table public.poll_votes enable row level security;

-- Prédications : tout le monde écoute ; publication réservée.
create policy "Écouter les prédications" on public.sermons for select to authenticated using (true);
create policy "Publier une prédication" on public.sermons for all to authenticated
  using ((select private.has_permission('sermons.manage'))) with check ((select private.has_permission('sermons.manage')));

-- Événements
create policy "Voir les événements" on public.church_events for select to authenticated using (true);
create policy "Organiser un événement" on public.church_events for all to authenticated
  using ((select private.has_permission('events.manage'))) with check ((select private.has_permission('events.manage')));
create policy "Voir les inscriptions" on public.event_registrations for select to authenticated
  using (person_id = (select private.current_person_id()) or (select private.has_permission('events.manage')));
create policy "S'inscrire" on public.event_registrations for insert to authenticated
  with check (person_id = (select private.current_person_id())
              and exists (select 1 from public.church_events e where e.id = event_id and e.registration));
create policy "Se désinscrire" on public.event_registrations for delete to authenticated
  using (person_id = (select private.current_person_id()) or (select private.has_permission('events.manage')));

-- Formations
create or replace function private.can_manage_training(p_training uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_permission('trainings.manage')
    or exists (select 1 from public.trainings t where t.id = p_training and t.group_id is not null
               and private.has_permission('groups.manage', t.group_id));
$$;

create policy "Voir les formations" on public.trainings for select to authenticated using (true);
create policy "Créer une formation" on public.trainings for insert to authenticated
  with check ((select private.has_permission('trainings.manage'))
              or (group_id is not null and (select private.has_permission('groups.manage', group_id))));
create policy "Modifier une formation" on public.trainings for update to authenticated
  using ((select private.can_manage_training(id))) with check ((select private.can_manage_training(id)));
create policy "Voir les leçons" on public.training_lessons for select to authenticated using (true);
create policy "Rédiger les leçons" on public.training_lessons for all to authenticated
  using ((select private.can_manage_training(training_id))) with check ((select private.can_manage_training(training_id)));
create policy "Voir les inscriptions aux formations" on public.training_enrollments for select to authenticated
  using (person_id = (select private.current_person_id()) or (select private.can_manage_training(training_id)) or (select private.can_see_person(person_id)));
create policy "Inscrire à une formation" on public.training_enrollments for insert to authenticated
  with check (person_id = (select private.current_person_id()) or (select private.can_manage_training(training_id)));
create policy "Voir la progression" on public.lesson_progress for select to authenticated
  using (person_id = (select private.current_person_id()) or (select private.can_see_person(person_id))
         or exists (select 1 from public.training_lessons l where l.id = lesson_id and private.can_manage_training(l.training_id)));
create policy "Valider une leçon" on public.lesson_progress for insert to authenticated
  with check (exists (select 1 from public.training_lessons l where l.id = lesson_id and private.can_manage_training(l.training_id)));
create policy "Annuler une leçon" on public.lesson_progress for delete to authenticated
  using (exists (select 1 from public.training_lessons l where l.id = lesson_id and private.can_manage_training(l.training_id)));

-- Registre des actes : lecture pour les concernés et ceux qui voient leur fiche ; écriture réservée.
create policy "Voir les actes" on public.acts for select to authenticated
  using ((select private.has_permission('acts.manage')) or (select private.current_person_id()) = any (person_ids)
         or exists (select 1 from unnest(person_ids) pid where private.can_see_person(pid)));
create policy "Enregistrer un acte" on public.acts for insert to authenticated
  with check ((select private.has_permission('acts.manage')));

-- Liens entre personnes : visibles de qui voit la fiche ; gérés par qui gère la fiche.
create policy "Voir les liens" on public.person_relations for select to authenticated
  using ((select private.can_see_person(person_id)));
create policy "Gérer les liens" on public.person_relations for all to authenticated
  using ((select private.can_manage_person(person_id))) with check ((select private.can_manage_person(person_id)));

-- Inventaire : église (inventory.manage) ou groupe responsable (groups.manage dans le groupe).
create or replace function private.can_manage_item(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_permission('inventory.manage') or (p_group is not null and private.has_permission('groups.manage', p_group));
$$;

create policy "Voir l'inventaire" on public.inventory_items for select to authenticated
  using ((select private.can_manage_item(group_id)) or (group_id is not null and (select private.can_see_group(group_id))));
create policy "Gérer l'inventaire" on public.inventory_items for all to authenticated
  using ((select private.can_manage_item(group_id))) with check ((select private.can_manage_item(group_id)));
create policy "Voir les mouvements" on public.inventory_movements for select to authenticated
  using (exists (select 1 from public.inventory_items i where i.id = item_id and private.can_manage_item(i.group_id)));
create policy "Noter un mouvement" on public.inventory_movements for insert to authenticated
  with check (exists (select 1 from public.inventory_items i where i.id = item_id and private.can_manage_item(i.group_id))
              and created_by = (select private.current_person_id()));

-- Sondages : ciblés (église ou groupe) ; chacun ne voit que son propre vote ; résultats agrégés.
create policy "Voir les sondages qui me concernent" on public.polls for select to authenticated
  using (group_id is null or (select private.is_group_member(group_id)) or (select private.has_permission('groups.manage', group_id))
         or (select private.has_permission('polls.manage')));
create policy "Lancer un sondage" on public.polls for insert to authenticated
  with check (created_by = (select private.current_person_id())
              and ((group_id is null and (select private.has_permission('polls.manage')))
                   or (group_id is not null and ((select private.has_permission('groups.manage', group_id)) or (select private.has_permission('polls.manage'))))));
create policy "Clore un sondage" on public.polls for update to authenticated
  using (created_by = (select private.current_person_id()) or (select private.has_permission('polls.manage')))
  with check (created_by = (select private.current_person_id()) or (select private.has_permission('polls.manage')));
create policy "Mon vote" on public.poll_votes for select to authenticated
  using (person_id = (select private.current_person_id()));
create policy "Voter" on public.poll_votes for insert to authenticated
  with check (
    person_id = (select private.current_person_id())
    and exists (select 1 from public.polls p where p.id = poll_id
                and (p.closes_on is null or p.closes_on >= current_date)
                and option_index < array_length(p.options, 1)
                and (p.group_id is null or private.is_group_member(p.group_id)))
  );

revoke all on public.sermons, public.church_events, public.event_registrations, public.trainings, public.training_lessons,
  public.training_enrollments, public.lesson_progress, public.acts, public.person_relations, public.inventory_items,
  public.inventory_movements, public.polls, public.poll_votes from anon, authenticated;
grant select, insert, update, delete on public.sermons, public.church_events, public.training_lessons, public.person_relations,
  public.inventory_items to authenticated;
grant select, insert, delete on public.event_registrations, public.lesson_progress to authenticated;
grant select, insert, update on public.trainings to authenticated;
grant select, insert on public.training_enrollments, public.acts, public.inventory_movements, public.poll_votes to authenticated;
grant select, insert on public.polls to authenticated;
grant update (closes_on) on public.polls to authenticated;
grant all on public.sermons, public.church_events, public.event_registrations, public.trainings, public.training_lessons,
  public.training_enrollments, public.lesson_progress, public.acts, public.person_relations, public.inventory_items,
  public.inventory_movements, public.polls, public.poll_votes to service_role;
grant usage on sequence public.act_seq, public.training_certificate_seq to authenticated, service_role;

-- ===========================================================================
-- Fonctions
-- ===========================================================================

-- Numéro de certificat (B-2026-0001, M-…, P-…) attribué par la base ; baptême reporté sur la fiche.
create or replace function private.number_act()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.certificate_no := case new.kind when 'baptism' then 'B-' when 'wedding' then 'M-' else 'P-' end
    || to_char(new.act_date, 'YYYY') || '-' || lpad(nextval('public.act_seq')::text, 4, '0');
  return new;
end;
$$;
create trigger acts_number before insert on public.acts for each row execute function private.number_act();

create or replace function private.act_side_effects()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare bap uuid;
begin
  if new.kind = 'baptism' then
    update public.people set baptized_at = new.act_date where id = new.person_ids[1] and baptized_at is null;
    select id into bap from public.integration_steps where code = 'baptism';
    if bap is not null then
      insert into public.person_steps (person_id, step_id, done_on, done_by)
      values (new.person_ids[1], bap, new.act_date, private.current_person_id()) on conflict do nothing;
    end if;
  elsif new.kind = 'wedding' and array_length(new.person_ids, 1) >= 2 then
    update public.people set marital_status = 'married' where id = any (new.person_ids[1:2]);
    insert into public.person_relations (person_id, related_id, relation) values
      (new.person_ids[1], new.person_ids[2], 'spouse'), (new.person_ids[2], new.person_ids[1], 'spouse')
    on conflict (person_id, related_id) do update set relation = 'spouse';
  end if;
  return new;
end;
$$;
create trigger acts_side_effects after insert on public.acts for each row execute function private.act_side_effects();

-- Fin d'une formation : toutes les leçons validées → attestation numérotée ; étape d'intégration cochée.
create or replace function private.complete_training()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.trainings;
  total integer;
  done integer;
  step uuid;
begin
  select tr.* into t from public.trainings tr join public.training_lessons l on l.training_id = tr.id where l.id = new.lesson_id;
  select count(*) into total from public.training_lessons where training_id = t.id;
  select count(*) into done from public.lesson_progress p join public.training_lessons l on l.id = p.lesson_id
    where l.training_id = t.id and p.person_id = new.person_id;
  if total > 0 and done >= total then
    update public.training_enrollments
    set completed_on = current_date,
        certificate_no = coalesce(certificate_no, 'F-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.training_certificate_seq')::text, 4, '0'))
    where training_id = t.id and person_id = new.person_id and completed_on is null;
    if t.integration_step_code is not null then
      select id into step from public.integration_steps where code = t.integration_step_code;
      if step is not null then
        insert into public.person_steps (person_id, step_id, done_by) values (new.person_id, step, private.current_person_id()) on conflict do nothing;
      end if;
    end if;
    insert into public.notifications (person_id, title, body, link, kind)
    values (new.person_id, 'Formation terminée !', '« ' || t.title || ' » : votre attestation est prête.', '/formations/' || t.id, 'training');
  end if;
  return new;
end;
$$;
create trigger lesson_progress_complete after insert on public.lesson_progress for each row execute function private.complete_training();

-- Résultats d'un sondage (agrégés ; jamais qui a voté quoi si le sondage est anonyme).
create or replace function public.poll_results(p_poll uuid)
returns table (option_index integer, votes bigint, voters text[])
language plpgsql
stable
security definer
set search_path = ''
as $$
declare p public.polls;
begin
  select * into p from public.polls where id = p_poll;
  if p.id is null or not (p.group_id is null or private.is_group_member(p.group_id) or private.has_permission('polls.manage')
                         or private.has_permission('groups.manage', p.group_id)) then
    raise exception 'Sondage introuvable.' using errcode = '42501';
  end if;
  return query
  select v.option_index, count(*),
         case when p.anonymous or not (private.has_permission('polls.manage') or p.created_by = private.current_person_id()) then null
              else array_agg(pe.first_name || ' ' || pe.last_name) end
  from public.poll_votes v join public.people pe on pe.id = v.person_id
  where v.poll_id = p_poll
  group by v.option_index;
end;
$$;
revoke all on function public.poll_results(uuid) from public, anon;
grant execute on function public.poll_results(uuid) to authenticated;

-- Nouveau sondage : les personnes concernées sont prévenues.
create or replace function private.notify_poll()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (person_id, title, body, link, kind)
  select x.person_id, 'Votre avis compte', new.question, '/sondages', 'poll'
  from (
    select gm.person_id from public.group_memberships gm where new.group_id is not null and gm.group_id = new.group_id and gm.end_date is null
    union
    select u.person_id from public.users u where new.group_id is null
  ) x
  where x.person_id is distinct from new.created_by;
  return new;
end;
$$;
create trigger polls_notify after insert on public.polls for each row execute function private.notify_poll();

-- Nouvel événement : annoncé à tous ceux qui ont un compte.
create or replace function private.notify_church_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (person_id, title, body, link, kind)
  select u.person_id, new.title, to_char(new.starts_at, 'DD/MM à HH24"h"MI') || coalesce(' · ' || new.place, ''), '/evenements', 'event'
  from public.users u;
  return new;
end;
$$;
create trigger church_events_notify after insert on public.church_events for each row execute function private.notify_church_event();

-- Enfants d'une classe d'école du dimanche, avec parents et personnes autorisées (moniteurs).
create or replace function public.class_children(p_group uuid)
returns table (child_id uuid, child text, birth_date date, adults jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.has_permission('people.view', p_group) or private.has_permission('groups.manage', p_group)) then
    raise exception 'Réservé aux moniteurs de la classe.' using errcode = '42501';
  end if;
  return query
  select p.id, upper(p.last_name) || ' ' || p.first_name, p.birth_date,
         coalesce((select jsonb_agg(jsonb_build_object('name', a.first_name || ' ' || a.last_name, 'relation', r.relation,
                                                       'phone', coalesce(a.whatsapp, a.phone), 'can_pickup', r.can_pickup))
                   from public.person_relations r join public.people a on a.id = r.related_id
                   where r.person_id = p.id and (r.can_pickup or r.relation in ('parent', 'guardian'))), '[]'::jsonb)
  from public.group_memberships gm
  join public.people p on p.id = gm.person_id and p.deleted_at is null
  left join public.group_functions f on f.id = gm.function_id
  where gm.group_id = p_group and gm.end_date is null and f.id is null
  order by p.last_name, p.first_name;
end;
$$;
revoke all on function public.class_children(uuid) from public, anon;
grant execute on function public.class_children(uuid) to authenticated;

-- Rappels d'entretien de l'inventaire (cron : 7 jours avant).
create or replace function public.notify_inventory_maintenance(p_today date default current_date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  insert into public.notifications (person_id, title, body, link, kind)
  select distinct x.person_id, 'Entretien à prévoir', i.name || ' : entretien prévu le ' || to_char(i.next_maintenance_on, 'DD/MM') || '.', '/inventaire', 'inventory'
  from public.inventory_items i
  cross join lateral (
    select ra.person_id from public.role_assignments ra join public.roles r on r.id = ra.role_id
    where 'inventory.manage' = any (r.permissions) and ra.start_date <= p_today and (ra.end_date is null or ra.end_date >= p_today)
    union
    select gm.person_id from public.group_memberships gm join public.group_functions f on f.id = gm.function_id
    where i.group_id is not null and gm.group_id = i.group_id and gm.end_date is null and 'groups.manage' = any (f.permissions)
  ) x
  where i.active and i.next_maintenance_on = p_today + 7;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.notify_inventory_maintenance(date) from public, anon, authenticated;
grant execute on function public.notify_inventory_maintenance(date) to service_role;

-- Prédications audio : stockage lisible par les personnes connectées.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('predications', 'predications', false, 52428800, array['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm'])
on conflict (id) do nothing;
create policy "Prédications : écouter" on storage.objects for select to authenticated using (bucket_id = 'predications');
create policy "Prédications : déposer" on storage.objects for insert to authenticated
  with check (bucket_id = 'predications' and (select private.has_permission('sermons.manage')));

-- Modules
update public.modules set enabled = true, href = '/predications' where code = 'sermons';
update public.modules set enabled = true, href = '/evenements', label = 'Événements' where code = 'events';
insert into public.modules (code, label, description, icon, href, enabled, home_position, nav_position, required_permissions, required_scope) values
  ('trainings', 'Formations', 'Parcours de formation, progression, attestations', 'graduation-cap', '/formations', true, null, null, '{trainings.manage,groups.manage}', 'any'),
  ('acts', 'Registre des actes', 'Baptêmes, mariages, présentations d''enfants, certificats', 'scroll-text', '/actes', true, null, null, '{acts.manage}', 'church'),
  ('inventory', 'Inventaire', 'Biens de l''église, prêts, entretien', 'package', '/inventaire', true, null, null, '{inventory.manage,groups.manage}', 'any'),
  ('polls', 'Sondages', 'Donner son avis, lancer un sondage', 'vote', '/sondages', true, null, null, '{polls.manage,groups.manage}', 'any')
on conflict (code) do update set enabled = true, href = excluded.href, required_permissions = excluded.required_permissions, required_scope = excluded.required_scope;
