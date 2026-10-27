-- Lot 1, étape 5 — Espace fidèle (docs/01 §12) : domicile, anniversaires, messages groupés, audiences.
--
-- people_locations    : position GPS du domicile, visible du seul périmètre autorisé
-- location_tokens     : lien envoyé à un fidèle sans compte pour qu'il partage sa position
-- message_templates   : modèles de messages ({prénom}…), modifiables
-- broadcasts (+ broadcast_recipients) : messages groupés (notification dans l'appli ou WhatsApp assisté)
-- appointments        : audiences avec le pasteur (créneaux du mercredi, paramétrables)

insert into public.permissions (code, label, description, position) values
  ('location.view', 'Voir les domiciles', 'Position GPS des domiciles de toute l''église (pasteur, assistants)', 12),
  ('audiences.manage', 'Gérer les audiences', 'Confirmer ou annuler les rendez-vous avec le pasteur', 13)
on conflict (code) do nothing;

update public.roles set permissions = array(select distinct unnest(permissions || '{location.view,audiences.manage}'))
where code in ('pastor', 'assistant_pastor');

insert into public.settings (key, label, is_public, value) values
  ('audience_schedule', 'Audiences avec le pasteur', true,
   jsonb_build_object('weekday', 3, 'start', '14:00', 'end', '19:30', 'slot_minutes', 30, 'weeks_ahead', 3))
on conflict (key) do nothing;

-- ===========================================================================
-- Domicile
-- ===========================================================================
create table public.people_locations (
  person_id uuid primary key references public.people (id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy_m integer,
  set_at timestamptz not null default now(),
  set_by uuid references auth.users (id) on delete set null
);

create table public.location_tokens (
  token text primary key default encode(extensions.gen_random_bytes(18), 'hex'),
  person_id uuid not null references public.people (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create index location_tokens_person_idx on public.location_tokens (person_id);

create trigger people_locations_audit after insert or update or delete on public.people_locations
  for each row execute function private.audit();

-- Domicile visible : la personne, le pasteur et ses assistants, le père de famille
-- (gère la fiche) et le délégué qui suit la personne (CLAUDE.md, confidentialité).
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
    or target in (select private.delegated_people());
$$;

revoke all on function private.can_see_home(uuid) from public, anon;
grant execute on function private.can_see_home(uuid) to authenticated;

alter table public.people_locations enable row level security;
alter table public.location_tokens enable row level security;

create policy "Voir le domicile (périmètre restreint)" on public.people_locations for select to authenticated
  using ((select private.can_see_home(person_id)));
create policy "Enregistrer son domicile" on public.people_locations for insert to authenticated
  with check (person_id = (select private.current_person_id()) or (select private.can_manage_person(person_id)));
create policy "Mettre à jour son domicile" on public.people_locations for update to authenticated
  using (person_id = (select private.current_person_id()) or (select private.can_manage_person(person_id)))
  with check (person_id = (select private.current_person_id()) or (select private.can_manage_person(person_id)));

create policy "Voir les liens de position" on public.location_tokens for select to authenticated
  using ((select private.can_manage_person(person_id)));
create policy "Créer un lien de position" on public.location_tokens for insert to authenticated
  with check ((select private.can_manage_person(person_id)));

revoke all on public.people_locations, public.location_tokens from anon, authenticated;
grant select, insert, update on public.people_locations to authenticated;
grant select, insert on public.location_tokens to authenticated;
grant all on public.people_locations, public.location_tokens to service_role;

-- ===========================================================================
-- Modèles de messages
-- ===========================================================================
create table public.message_templates (
  code text primary key,
  label text not null,
  body text not null,
  updated_at timestamptz not null default now()
);

create trigger message_templates_audit after insert or update or delete on public.message_templates
  for each row execute function private.audit();

alter table public.message_templates enable row level security;
create policy "Lire les modèles" on public.message_templates for select to authenticated using (true);
create policy "Modifier les modèles" on public.message_templates for update to authenticated
  using ((select private.has_permission('settings.manage')))
  with check ((select private.has_permission('settings.manage')));
revoke all on public.message_templates from anon, authenticated;
grant select, update on public.message_templates to authenticated;
grant all on public.message_templates to service_role;

insert into public.message_templates (code, label, body) values
  ('welcome', 'Bienvenue',
   'Bonjour {prénom}, merci d''être venu(e) aux Semeurs de la Parole. Jésus-Christ t''aime. Nous serons heureux de te revoir dimanche de 9 h à 12 h, Yopougon Camp Militaire, carrefour Gandhi.'),
  ('service_reminder', 'Rappel du culte',
   'Bonjour {prénom}, rappel : culte d''actions de grâces demain de 9 h à 12 h. Nous comptons sur toi.'),
  ('birthday', 'Anniversaire',
   'Joyeux anniversaire {prénom} ! Toute la famille des Semeurs de la Parole te bénit. Que le Seigneur te comble de sa grâce.'),
  ('absence_followup', 'Prise de nouvelles',
   'Bonjour {prénom}, tu nous as manqué au culte. Comment vas-tu ? Nous prions pour toi.')
on conflict (code) do nothing;

-- ===========================================================================
-- Anniversaires (appelé chaque matin avec les alertes)
-- ===========================================================================
create or replace function public.notify_birthdays(p_today date default (now() at time zone 'Africa/Abidjan')::date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  with born as (
    select p.id, p.first_name, p.last_name from public.people p
    where p.deleted_at is null and p.birth_date is not null
      and extract(month from p.birth_date) = extract(month from p_today)
      and extract(day from p.birth_date) = extract(day from p_today)
      and p.status not in ('left', 'deceased')
  ),
  recipients as (
    -- La personne elle-même
    select b.id as recipient, b.id as born_id, true as self from born b
    union
    -- Ses responsables de famille (père, mère, adjoints)
    select gm2.person_id, b.id, false from born b
    join public.group_memberships gm on gm.person_id = b.id and gm.end_date is null
    join public.groups g on g.id = gm.group_id
    join public.group_types gt on gt.id = g.type_id and gt.slug = 'family'
    join public.group_memberships gm2 on gm2.group_id = g.id and gm2.end_date is null
    join public.group_functions f on f.id = gm2.function_id and 'alerts.manage' = any (f.permissions)
    where gm2.person_id <> b.id
  )
  insert into public.notifications (person_id, title, body, link, kind)
  select r.recipient,
         case when r.self then 'Joyeux anniversaire, ' || b.first_name || ' !'
              else 'Anniversaire : ' || b.first_name || ' ' || upper(b.last_name) end,
         case when r.self then 'Toute l''église te bénit en ce jour.'
              else 'Souhaitez-lui un joyeux anniversaire.' end,
         case when r.self then null else '/fideles/' || b.id end,
         'birthday'
  from recipients r join born b on b.id = r.born_id
  where not exists (
    select 1 from public.notifications x
    where x.person_id = r.recipient and x.kind = 'birthday' and x.created_at::date = p_today
      and x.title like '%' || b.first_name || '%'
  );
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.notify_birthdays(date) from public, anon, authenticated;
grant execute on function public.notify_birthdays(date) to service_role;

-- ===========================================================================
-- Messages groupés
-- ===========================================================================
create table public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.people (id) on delete set null,
  title text not null,
  body text not null,
  group_ids uuid[], -- null = toute l'église
  channel text not null check (channel in ('app', 'whatsapp')),
  recipient_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.broadcast_recipients (
  broadcast_id uuid not null references public.broadcasts (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  sent_at timestamptz, -- WhatsApp assisté : moment où l'auteur a ouvert la conversation
  primary key (broadcast_id, person_id)
);

alter table public.broadcasts enable row level security;
alter table public.broadcast_recipients enable row level security;

create policy "Voir ses messages envoyés" on public.broadcasts for select to authenticated
  using (author_id = (select private.current_person_id()) or (select private.has_permission('messages.send')));
create policy "Voir les destinataires de ses messages" on public.broadcast_recipients for select to authenticated
  using (exists (select 1 from public.broadcasts b where b.id = broadcast_id
                 and (b.author_id = (select private.current_person_id()) or (select private.has_permission('messages.send')))));
create policy "Cocher un envoi WhatsApp" on public.broadcast_recipients for update to authenticated
  using (exists (select 1 from public.broadcasts b where b.id = broadcast_id and b.author_id = (select private.current_person_id())))
  with check (exists (select 1 from public.broadcasts b where b.id = broadcast_id and b.author_id = (select private.current_person_id())));

revoke all on public.broadcasts, public.broadcast_recipients from anon, authenticated;
grant select on public.broadcasts to authenticated;
grant select, update (sent_at) on public.broadcast_recipients to authenticated;
grant all on public.broadcasts, public.broadcast_recipients to service_role;

-- Envoie un message à toute l'église (droit d'église) ou à des groupes où l'on a « messages.send ».
-- {prénom} est remplacé pour chaque destinataire.
create or replace function public.send_broadcast(p_title text, p_body text, p_group_ids uuid[], p_channel text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.current_person_id();
  bid uuid;
  g uuid;
  n integer;
begin
  if me is null then
    raise exception 'Compte non rattaché à une fiche.' using errcode = '42501';
  end if;
  if p_group_ids is null or cardinality(p_group_ids) = 0 then
    if not private.has_permission('messages.send') then
      raise exception 'Vous ne pouvez écrire qu''aux groupes dont vous êtes responsable.' using errcode = '42501';
    end if;
  else
    foreach g in array p_group_ids loop
      if not private.has_permission('messages.send', g) then
        raise exception 'Vous ne pouvez écrire qu''aux groupes dont vous êtes responsable.' using errcode = '42501';
      end if;
    end loop;
  end if;

  insert into public.broadcasts (author_id, title, body, group_ids, channel)
  values (me, trim(p_title), trim(p_body), nullif(p_group_ids, '{}'), p_channel)
  returning id into bid;

  insert into public.broadcast_recipients (broadcast_id, person_id)
  select distinct bid, p.id from public.people p
  where p.deleted_at is null and p.status not in ('left', 'deceased') and p.id <> me
    and (
      p_group_ids is null or cardinality(p_group_ids) = 0
      or exists (select 1 from public.group_memberships gm
                 where gm.person_id = p.id and gm.end_date is null and gm.group_id = any (p_group_ids))
    );
  get diagnostics n = row_count;
  update public.broadcasts set recipient_count = n where id = bid;

  if p_channel = 'app' then
    insert into public.notifications (person_id, title, body, kind)
    select br.person_id, trim(p_title), replace(trim(p_body), '{prénom}', p.first_name), 'message'
    from public.broadcast_recipients br join public.people p on p.id = br.person_id
    where br.broadcast_id = bid;
  end if;
  return bid;
end;
$$;

-- Destinataires d'un message WhatsApp assisté (prénom et téléphone seulement), pour son auteur.
create or replace function public.broadcast_whatsapp_list(p_broadcast uuid)
returns table (person_id uuid, first_name text, last_name text, phone text, sent_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.first_name, p.last_name, coalesce(p.whatsapp, p.phone), br.sent_at
  from public.broadcast_recipients br
  join public.broadcasts b on b.id = br.broadcast_id
  join public.people p on p.id = br.person_id
  where br.broadcast_id = p_broadcast and b.author_id = private.current_person_id()
  order by p.last_name, p.first_name;
$$;

revoke all on function public.send_broadcast(text, text, uuid[], text), public.broadcast_whatsapp_list(uuid) from public, anon;
grant execute on function public.send_broadcast(text, text, uuid[], text), public.broadcast_whatsapp_list(uuid) to authenticated;

-- ===========================================================================
-- Audiences avec le pasteur
-- ===========================================================================
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  starts_at timestamptz not null,
  topic text, -- visible du fidèle et des personnes qui gèrent les audiences
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'cancelled', 'done')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

-- Un créneau ne peut être pris qu'une fois.
create unique index appointments_slot_uniq on public.appointments (starts_at) where status in ('requested', 'confirmed');
create index appointments_person_idx on public.appointments (person_id, starts_at desc);

create trigger appointments_audit after insert or update or delete on public.appointments
  for each row execute function private.audit();

alter table public.appointments enable row level security;
create policy "Voir ses audiences" on public.appointments for select to authenticated
  using (person_id = (select private.current_person_id()) or (select private.has_permission('audiences.manage')));
create policy "Demander une audience" on public.appointments for insert to authenticated
  with check (
    (person_id = (select private.current_person_id()) and status = 'requested')
    or (select private.has_permission('audiences.manage'))
  );
create policy "Gérer les audiences" on public.appointments for update to authenticated
  using ((select private.has_permission('audiences.manage')) or person_id = (select private.current_person_id()))
  with check ((select private.has_permission('audiences.manage')) or (person_id = (select private.current_person_id()) and status = 'cancelled'));

revoke all on public.appointments from anon, authenticated;
grant select, insert, update on public.appointments to authenticated;
grant all on public.appointments to service_role;

-- Créneaux libres des prochains jours d'audience (sans révéler qui a réservé).
create or replace function public.available_slots()
returns setof timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cfg jsonb := (select value from public.settings where key = 'audience_schedule');
  d date := (now() at time zone 'Africa/Abidjan')::date;
  last_day date := d + ((cfg ->> 'weeks_ahead')::int * 7);
  slot timestamptz;
begin
  while d <= last_day loop
    if extract(dow from d) = (cfg ->> 'weekday')::int then
      for slot in
        select gs from generate_series(
          (d + (cfg ->> 'start')::time) at time zone 'Africa/Abidjan',
          (d + (cfg ->> 'end')::time) at time zone 'Africa/Abidjan' - make_interval(mins => (cfg ->> 'slot_minutes')::int),
          make_interval(mins => (cfg ->> 'slot_minutes')::int)
        ) as gs
      loop
        if slot > now() and not exists (
          select 1 from public.appointments a where a.starts_at = slot and a.status in ('requested', 'confirmed')
        ) then
          return next slot;
        end if;
      end loop;
    end if;
    d := d + 1;
  end loop;
end;
$$;

revoke all on function public.available_slots() from public, anon;
grant execute on function public.available_slots() to authenticated;

-- Notifications : demande → pasteur et assistants ; confirmation ou annulation → le fidèle.
create or replace function private.notify_appointment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  who text := (select first_name || ' ' || upper(last_name) from public.people where id = new.person_id);
  at_text text := to_char(new.starts_at at time zone 'Africa/Abidjan', 'DD/MM à HH24"h"MI');
begin
  if tg_op = 'INSERT' and new.status = 'requested' then
    insert into public.notifications (person_id, title, body, link, kind)
    select distinct ra.person_id, 'Demande d''audience : ' || who, 'Le ' || at_text, '/audiences', 'appointment'
    from public.role_assignments ra join public.roles r on r.id = ra.role_id
    where ra.scope_type = 'church' and 'audiences.manage' = any (r.permissions)
      and ra.start_date <= current_date and (ra.end_date is null or ra.end_date >= current_date)
      and ra.person_id <> new.person_id;
  elsif tg_op = 'UPDATE' and new.status <> old.status and new.status in ('confirmed', 'cancelled')
        and new.person_id <> coalesce(private.current_person_id(), '00000000-0000-0000-0000-000000000000') then
    insert into public.notifications (person_id, title, body, link, kind)
    values (new.person_id,
            case new.status when 'confirmed' then 'Audience confirmée' else 'Audience annulée' end,
            'Le ' || at_text, '/audiences', 'appointment');
  end if;
  return null;
end;
$$;

create trigger appointments_notify after insert or update on public.appointments
  for each row execute function private.notify_appointment();

-- ===========================================================================
-- Modules
-- ===========================================================================
update public.modules set enabled = true, href = '/messages', label = 'Annonces',
  description = 'Messages de l''église et de vos groupes'
where code = 'messages';

insert into public.modules (code, label, description, icon, href, enabled, home_position, nav_position,
                            required_permissions, required_scope)
values ('audiences', 'Audiences', 'Rendez-vous avec le pasteur (mercredi)', 'calendar-clock', '/audiences', true,
        null, null, '{}', 'any')
on conflict (code) do nothing;
