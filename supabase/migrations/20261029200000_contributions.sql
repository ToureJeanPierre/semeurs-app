-- Lot 2 — Cotisations et reçus (docs/01 §8.1, docs/02 §4.4).
--
-- contribution_headings  : une rubrique (mariage, décès, cotisation mensuelle d'équipe, projet…)
--                          pour une famille, un groupe ou toute l'église
-- contribution_payments  : versements : saisis par la trésorière (validés d'emblée) ou déclarés
--                          par le fidèle avec la référence Mobile Money, puis validés
--
-- Règles financières (CLAUDE.md §5) :
--  * aucun versement ne se supprime (pas de droit DELETE) ;
--  * un versement validé ne se modifie plus : on l'annule par une contre-opération
--    motivée (montant négatif, reverses_id) ;
--  * reçu numéroté attribué à la validation ; tout est journalisé (audit_log).

insert into public.permissions (code, label, description, position) values
  ('contributions.manage', 'Gérer les cotisations', 'Lancer une cotisation, saisir et valider les versements, relancer', 15),
  ('contributions.view', 'Suivre les cotisations', 'Voir qui a payé et les montants collectés', 16)
on conflict (code) do nothing;

-- Choix prudents (à confirmer) : les caissiers gèrent les cotisations de toute l'église ;
-- le pasteur et l'assistant les suivent.
update public.roles set permissions = array(select distinct unnest(permissions || '{contributions.manage}'))
where code = 'cashier';
update public.roles set permissions = array(select distinct unnest(permissions || '{contributions.view}'))
where code in ('pastor', 'assistant_pastor');

-- Dans les groupes : la trésorière de famille et les responsables gèrent ; père et mère suivent.
update public.group_functions f set permissions = array(select distinct unnest(f.permissions || '{contributions.manage}'))
from public.group_types t
where t.id = f.type_id and ((t.slug = 'family' and f.label = 'Trésorière') or (t.slug in ('team', 'youth') and f.rank = 1));
update public.group_functions f set permissions = array(select distinct unnest(f.permissions || '{contributions.view}'))
from public.group_types t
where t.id = f.type_id and t.slug = 'family' and f.rank in (1, 2);

insert into public.value_lists (list_code, value, label, position) values
  ('contribution_kind', 'support', 'Soutien', 1),
  ('contribution_kind', 'wedding', 'Mariage', 2),
  ('contribution_kind', 'death', 'Décès', 3),
  ('contribution_kind', 'birth', 'Naissance', 4),
  ('contribution_kind', 'illness', 'Maladie', 5),
  ('contribution_kind', 'monthly', 'Cotisation mensuelle', 6),
  ('contribution_kind', 'event', 'Événement', 7),
  ('contribution_kind', 'project', 'Projet', 8),
  ('payment_method', 'cash', 'Espèces', 1),
  ('payment_method', 'orange_money', 'Orange Money', 2),
  ('payment_method', 'mtn_momo', 'MTN MoMo', 3),
  ('payment_method', 'moov_money', 'Moov Money', 4),
  ('payment_method', 'wave', 'Wave', 5)
on conflict (list_code, value) do nothing;

insert into public.message_templates (code, label, body) values
  ('contribution_reminder', 'Relance de cotisation',
   'Bonjour {prénom}, petit rappel fraternel pour la cotisation « {cotisation} ». Que Dieu vous bénisse pour votre générosité.')
on conflict (code) do nothing;

-- La capacité « Cotisations » des groupes est désormais livrée.
update public.capabilities set available = true where code = 'contributions';

-- ===========================================================================
-- Tables
-- ===========================================================================
create table public.contribution_headings (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) >= 3),
  kind text not null default 'support',        -- liste « contribution_kind »
  description text,
  group_id uuid references public.groups (id) on delete restrict,  -- null = toute l'église
  beneficiary_id uuid references public.people (id) on delete set null,
  amount_mode text not null default 'free' check (amount_mode in ('fixed', 'free')),
  amount integer check (amount > 0),           -- montant attendu par personne (mode fixe)
  min_amount integer check (min_amount > 0),   -- minimum conseillé (mode libre)
  target_amount integer check (target_amount > 0),
  recurrence text not null default 'none' check (recurrence in ('none', 'monthly')),
  starts_on date not null default current_date,
  due_date date,
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_at timestamptz,
  closed_by uuid references public.people (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  check (amount_mode = 'free' or amount is not null)
);

create index contribution_headings_group_idx on public.contribution_headings (group_id);

create sequence public.contribution_receipt_seq;

create table public.contribution_payments (
  id uuid primary key default gen_random_uuid(),
  heading_id uuid not null references public.contribution_headings (id) on delete restrict,
  person_id uuid not null references public.people (id) on delete restrict,
  amount integer not null check (amount <> 0),
  method text not null default 'cash',         -- liste « payment_method »
  reference text,                              -- référence Mobile Money
  period text check (period ~ '^\d{4}-\d{2}$'), -- mois concerné (cotisation mensuelle)
  status text not null default 'declared' check (status in ('declared', 'validated', 'rejected')),
  receipt_no text unique,
  declared_by uuid references public.people (id) on delete set null,
  validated_by uuid references public.people (id) on delete set null,
  validated_at timestamptz,
  reverses_id uuid unique references public.contribution_payments (id) on delete restrict, -- contre-opération
  reason text,                                 -- motif d'annulation ou de refus
  created_at timestamptz not null default now(),
  check ((amount > 0) = (reverses_id is null)),
  check (reverses_id is null or length(trim(coalesce(reason, ''))) >= 5)
);

create index contribution_payments_heading_idx on public.contribution_payments (heading_id, created_at desc);
create index contribution_payments_person_idx on public.contribution_payments (person_id);

create trigger contribution_headings_updated_at before update on public.contribution_headings
  for each row execute function public.set_updated_at();

do $$
declare t text;
begin
  foreach t in array array['contribution_headings', 'contribution_payments'] loop
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
create or replace function private.can_manage_heading(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case when p_group is null then private.has_permission('contributions.manage')
              else private.has_permission('contributions.manage', p_group) end;
$$;

create or replace function private.can_follow_heading(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_manage_heading(p_group)
    or private.has_permission('contributions.view', p_group);
$$;

-- Une cotisation d'église concerne tout le monde ; celle d'un groupe, ses membres.
create or replace function private.heading_concerns_me(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_group is null or exists (
    select 1 from public.group_memberships gm
    where gm.group_id = p_group and gm.person_id = private.current_person_id() and gm.end_date is null
  );
$$;

alter table public.contribution_headings enable row level security;
alter table public.contribution_payments enable row level security;

create policy "Voir les cotisations qui me concernent" on public.contribution_headings for select to authenticated
  using ((select private.heading_concerns_me(group_id)) or (select private.can_follow_heading(group_id)));
create policy "Lancer une cotisation" on public.contribution_headings for insert to authenticated
  with check ((select private.can_manage_heading(group_id)) and status = 'open');
create policy "Modifier ou clôturer une cotisation" on public.contribution_headings for update to authenticated
  using ((select private.can_manage_heading(group_id)))
  with check ((select private.can_manage_heading(group_id)));

create policy "Voir ses versements, ou ceux que l'on suit" on public.contribution_payments for select to authenticated
  using (
    person_id = (select private.current_person_id())
    or exists (select 1 from public.contribution_headings h where h.id = heading_id and private.can_follow_heading(h.group_id))
  );
-- La trésorière saisit (validé d'emblée) ; le fidèle déclare son propre versement.
create policy "Saisir ou déclarer un versement" on public.contribution_payments for insert to authenticated
  with check (
    exists (select 1 from public.contribution_headings h where h.id = heading_id and private.can_manage_heading(h.group_id))
    or (
      person_id = (select private.current_person_id()) and status = 'declared' and reverses_id is null
      and exists (select 1 from public.contribution_headings h where h.id = heading_id and private.heading_concerns_me(h.group_id))
    )
  );
create policy "Valider ou refuser une déclaration" on public.contribution_payments for update to authenticated
  using (exists (select 1 from public.contribution_headings h where h.id = heading_id and private.can_manage_heading(h.group_id)))
  with check (exists (select 1 from public.contribution_headings h where h.id = heading_id and private.can_manage_heading(h.group_id)));

revoke all on public.contribution_headings, public.contribution_payments from anon, authenticated;
grant select, insert, update on public.contribution_headings to authenticated;
grant select, insert on public.contribution_payments to authenticated;
grant update (status, reason) on public.contribution_payments to authenticated;
grant all on public.contribution_headings, public.contribution_payments to service_role;
grant usage on sequence public.contribution_receipt_seq to authenticated, service_role;

-- ===========================================================================
-- Garde-fous financiers
-- ===========================================================================
create or replace function private.guard_contribution_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  h public.contribution_headings;
  original public.contribution_payments;
  me uuid := private.current_person_id();
begin
  if tg_op = 'UPDATE' then
    if old.status <> 'declared' then
      raise exception 'Un versement validé ou refusé ne se modifie plus : annulez-le par une contre-opération.' using errcode = 'P0001';
    end if;
    if new.status = 'rejected' and length(trim(coalesce(new.reason, ''))) < 5 then
      raise exception 'Indiquez le motif du refus.' using errcode = 'P0001';
    end if;
    if new.heading_id <> old.heading_id or new.person_id <> old.person_id or new.amount <> old.amount then
      raise exception 'Seul le statut d''une déclaration peut changer.' using errcode = 'P0001';
    end if;
  end if;

  select * into h from public.contribution_headings where id = new.heading_id;

  if tg_op = 'INSERT' then
    new.declared_by := coalesce(new.declared_by, me);
    if new.reverses_id is not null then
      select * into original from public.contribution_payments where id = new.reverses_id;
      if original.id is null or original.status <> 'validated' or original.reverses_id is not null then
        raise exception 'Seul un versement validé peut être annulé.' using errcode = 'P0001';
      end if;
      if new.amount <> -original.amount or new.heading_id <> original.heading_id or new.person_id <> original.person_id then
        raise exception 'La contre-opération doit reprendre le versement à l''identique, en négatif.' using errcode = 'P0001';
      end if;
      new.status := 'validated';
    elsif h.status <> 'open' then
      raise exception 'Cette cotisation est clôturée.' using errcode = 'P0001';
    end if;
    if h.recurrence = 'monthly' and new.period is null and new.reverses_id is null then
      new.period := to_char(current_date, 'YYYY-MM');
    end if;
  end if;

  if new.status = 'validated' and (tg_op = 'INSERT' or old.status <> 'validated') then
    new.validated_by := me;
    new.validated_at := now();
    new.receipt_no := (case when new.amount < 0 then 'AN-' else 'R-' end)
      || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.contribution_receipt_seq')::text, 5, '0');
  elsif tg_op = 'INSERT' then
    new.validated_by := null;
    new.validated_at := null;
    new.receipt_no := null;
  end if;
  return new;
end;
$$;

create trigger contribution_payments_guard before insert or update on public.contribution_payments
  for each row execute function private.guard_contribution_payment();

-- Une cotisation clôturée ne se rouvre pas et ne change plus de montant.
create or replace function private.guard_contribution_heading()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'closed' then
    raise exception 'Cette cotisation est clôturée.' using errcode = 'P0001';
  end if;
  if new.status = 'closed' and old.status = 'open' then
    new.closed_at := now();
    new.closed_by := private.current_person_id();
  end if;
  if new.group_id is distinct from old.group_id then
    raise exception 'Le groupe d''une cotisation ne change pas.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger contribution_headings_guard before update on public.contribution_headings
  for each row execute function private.guard_contribution_heading();

-- ===========================================================================
-- Suivi : qui a payé (noms seulement, pour qui suit la cotisation)
-- ===========================================================================
create or replace function public.contribution_status(p_heading uuid, p_period text default null)
returns table (person_id uuid, name text, phone text, expected integer, paid integer, declared integer, state text)
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
  select e.id, e.last_name || ' ' || e.first_name, e.phone, h.amount,
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

-- Relance : une notification dans l'appli à chaque retardataire (la liste WhatsApp est préparée à l'écran).
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

-- Prévenir la trésorière quand un fidèle déclare un versement.
create or replace function private.notify_declared_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare h public.contribution_headings;
begin
  if new.status <> 'declared' then
    return new;
  end if;
  select * into h from public.contribution_headings where id = new.heading_id;
  insert into public.notifications (person_id, title, body, link, kind)
  select distinct x.person_id, 'Versement à valider',
         (select first_name || ' ' || last_name from public.people where id = new.person_id)
           || ' déclare ' || new.amount || ' FCFA pour « ' || h.title || ' ».',
         '/cotisations/' || h.id, 'contribution'
  from (
    select gm.person_id from public.group_memberships gm
    join public.group_functions f on f.id = gm.function_id
    where h.group_id is not null and gm.group_id = h.group_id and gm.end_date is null
      and 'contributions.manage' = any (f.permissions)
    union
    select ra.person_id from public.role_assignments ra join public.roles r on r.id = ra.role_id
    where 'contributions.manage' = any (r.permissions)
      and ra.start_date <= current_date and (ra.end_date is null or ra.end_date >= current_date)
      and (ra.scope_type = 'church' and h.group_id is null or ra.scope_id = h.group_id)
  ) x
  where x.person_id <> new.person_id;
  return new;
end;
$$;

create trigger contribution_payments_notify after insert on public.contribution_payments
  for each row execute function private.notify_declared_payment();

-- Module « Cotisations » (menu) : chacun y voit les siennes ; la trésorière y gère.
insert into public.modules (code, label, description, icon, href, enabled, home_position, nav_position, required_permissions, required_scope)
values ('contributions', 'Cotisations', 'Mes cotisations, mes reçus ; suivi des versements', 'wallet', '/cotisations', true, null, null, '{}', 'any')
on conflict (code) do update set enabled = true, href = excluded.href, label = excluded.label;
