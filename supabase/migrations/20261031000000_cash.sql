-- Lot 3 — Caisse de l'église (docs/01 §8.2, docs/02 §4.4, §5).
--
-- cash_accounts     : comptes (espèces, banque, Mobile Money), paramétrables
-- cash_operations   : recettes et dépenses ; saisie → seconde validation par un AUTRE caissier
--                     (quatre yeux) ; dépense au-delà du plafond → validation du pasteur ;
--                     jamais supprimée ni modifiée après validation : contre-opération motivée
-- offering_counts   : comptage des offrandes par coupures, confirmé par un second compteur
-- period_closings   : arrêté mensuel ; plus aucune écriture sur un mois clos
-- budgets           : budget annuel par catégorie
-- Le fidèle peut déclarer un don ou une dîme (Mobile Money) : le caissier la valide.

insert into public.permissions (code, label, description, position) values
  ('cash.manage', 'Tenir la caisse', 'Saisir et valider les opérations, compter les offrandes, arrêter le mois, gérer les engagements', 19),
  ('cash.approve', 'Approuver les grosses dépenses', 'Valider les dépenses au-delà du plafond', 20),
  ('cash.view', 'Consulter la caisse', 'Voir les soldes, les rapports et les dîmes nominatives', 21)
on conflict (code) do nothing;

update public.roles set permissions = array(select distinct unnest(permissions || '{cash.manage}')) where code = 'cashier';
update public.roles set permissions = array(select distinct unnest(permissions || '{cash.approve,cash.view}')) where code = 'pastor';
update public.roles set permissions = array(select distinct unnest(permissions || '{cash.view}')) where code = 'assistant_pastor';

insert into public.settings (key, value, label, is_public) values
  ('expense_ceiling', '50000', 'Plafond (FCFA) au-delà duquel une dépense doit être approuvée par le pasteur', false),
  ('cash_denominations', '[10000, 5000, 2000, 1000, 500, 250, 200, 100, 50, 25, 10, 5]', 'Coupures et pièces pour le comptage des offrandes', false)
on conflict (key) do nothing;

insert into public.value_lists (list_code, value, label, position) values
  ('income_category', 'offering', 'Offrande', 1),
  ('income_category', 'tithe', 'Dîme', 2),
  ('income_category', 'gift', 'Don', 3),
  ('income_category', 'thanksgiving', 'Action de grâce', 4),
  ('income_category', 'collection', 'Collecte', 5),
  ('income_category', 'pledge', 'Engagement (versement)', 6),
  ('income_category', 'other', 'Autre recette', 7),
  ('expense_category', 'rent', 'Loyer', 1),
  ('expense_category', 'utilities', 'Électricité, eau', 2),
  ('expense_category', 'transport', 'Transport', 3),
  ('expense_category', 'social', 'Aide sociale', 4),
  ('expense_category', 'evangelism', 'Évangélisation', 5),
  ('expense_category', 'equipment', 'Matériel, entretien', 6),
  ('expense_category', 'events', 'Événements', 7),
  ('expense_category', 'transfer', 'Versement à la banque', 8),
  ('expense_category', 'other', 'Autre dépense', 9)
on conflict (list_code, value) do nothing;

-- ===========================================================================
-- Tables
-- ===========================================================================
create table public.cash_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null check (kind in ('cash', 'bank', 'mobile_money')),
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.cash_accounts (name, kind, position) values
  ('Caisse (espèces)', 'cash', 1), ('Banque', 'bank', 2), ('Mobile Money', 'mobile_money', 3)
on conflict (name) do nothing;

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) >= 3),
  description text,
  target_amount integer check (target_amount > 0),
  start_date date not null default current_date,
  end_date date,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create table public.pledges (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete restrict,
  person_id uuid references public.people (id) on delete restrict,   -- null = anonyme
  anonymous_label text,                                              -- « Anonyme 3 »…
  amount integer not null check (amount > 0),
  due_date date,
  note text,
  created_by uuid references public.people (id) on delete set null,
  created_at timestamptz not null default now(),
  check (person_id is not null or anonymous_label is not null)
);

create index pledges_person_idx on public.pledges (person_id);

create sequence public.cash_receipt_seq;

create table public.cash_operations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.cash_accounts (id) on delete restrict,
  direction text not null check (direction in ('in', 'out')),
  amount integer not null check (amount <> 0),
  category text not null,                 -- listes « income_category » / « expense_category »
  label text,
  op_date date not null default current_date,
  method text,                            -- liste « payment_method » (Mobile Money…)
  reference text,
  person_id uuid references public.people (id) on delete restrict,  -- donateur, dîme nominative, bénéficiaire
  pledge_id uuid references public.pledges (id) on delete restrict,
  attachment_path text,                   -- justificatif photographié (stockage « justificatifs »)
  source text not null default 'manual' check (source in ('manual', 'count', 'declaration')),
  status text not null default 'pending' check (status in ('pending', 'awaiting_pastor', 'approved', 'rejected')),
  receipt_no text unique,
  entered_by uuid references public.people (id) on delete set null,
  checked_by uuid references public.people (id) on delete set null,
  checked_at timestamptz,
  approved_by uuid references public.people (id) on delete set null,
  approved_at timestamptz,
  reason text,
  reverses_id uuid unique references public.cash_operations (id) on delete restrict,
  created_at timestamptz not null default now(),
  check ((amount > 0) = (reverses_id is null)),
  check (reverses_id is null or length(trim(coalesce(reason, ''))) >= 5)
);

create index cash_operations_date_idx on public.cash_operations (op_date);
create index cash_operations_person_idx on public.cash_operations (person_id);
create index cash_operations_pledge_idx on public.cash_operations (pledge_id);

create table public.offering_counts (
  id uuid primary key default gen_random_uuid(),
  op_date date not null default current_date,
  service_label text,                     -- « Culte d'actions de grâces »…
  category text not null default 'offering',
  account_id uuid not null references public.cash_accounts (id) on delete restrict,
  denominations jsonb not null,           -- {"10000": 3, "5000": 2, …}
  total integer not null check (total > 0),
  counter_1 uuid references public.people (id) on delete set null,
  counter_2 uuid references public.people (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  operation_id uuid references public.cash_operations (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.period_closings (
  month text primary key check (month ~ '^\d{4}-\d{2}$'),
  closed_by uuid references public.people (id) on delete set null,
  closed_at timestamptz not null default now(),
  summary jsonb not null
);

create table public.budgets (
  year integer not null,
  category text not null,
  direction text not null check (direction in ('in', 'out')),
  amount integer not null check (amount >= 0),
  primary key (year, direction, category)
);

do $$
declare t text;
begin
  foreach t in array array['cash_accounts', 'campaigns', 'pledges', 'cash_operations', 'offering_counts', 'period_closings', 'budgets'] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.audit()',
      t || '_audit', t
    );
  end loop;
end;
$$;

-- ===========================================================================
-- Garde-fous financiers
-- ===========================================================================
create or replace function private.month_closed(p_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.period_closings where month = to_char(p_date, 'YYYY-MM'));
$$;

create or replace function private.guard_cash_operation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.current_person_id();
  ceiling integer;
  original public.cash_operations;
begin
  if private.month_closed(new.op_date) then
    raise exception 'Le mois de % est arrêté : plus aucune écriture possible.', to_char(new.op_date, 'MM/YYYY') using errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' then
    new.entered_by := coalesce(me, new.entered_by);
    new.status := 'pending';
    new.checked_by := null; new.checked_at := null; new.approved_by := null; new.approved_at := null; new.receipt_no := null;
    if new.reverses_id is not null then
      select * into original from public.cash_operations where id = new.reverses_id;
      if original.id is null or original.status <> 'approved' or original.reverses_id is not null then
        raise exception 'Seule une opération validée peut être annulée.' using errcode = 'P0001';
      end if;
      if new.amount <> -original.amount or new.direction <> original.direction or new.account_id <> original.account_id then
        raise exception 'La contre-opération doit reprendre l''opération à l''identique, en négatif.' using errcode = 'P0001';
      end if;
    end if;
    return new;
  end if;

  -- Mise à jour : seul le statut avance, jamais en arrière.
  if old.status in ('approved', 'rejected') then
    raise exception 'Une opération validée ou refusée ne se modifie plus : annulez-la par une contre-opération.' using errcode = 'P0001';
  end if;
  if new.amount <> old.amount or new.account_id <> old.account_id or new.direction <> old.direction
     or new.op_date <> old.op_date or new.category <> old.category or new.person_id is distinct from old.person_id then
    raise exception 'Seul le statut d''une opération en attente peut changer.' using errcode = 'P0001';
  end if;
  if new.status = 'rejected' and length(trim(coalesce(new.reason, ''))) < 5 then
    raise exception 'Indiquez le motif du refus.' using errcode = 'P0001';
  end if;

  if old.status = 'pending' and new.status in ('approved', 'awaiting_pastor', 'rejected') then
    -- Quatre yeux : celui qui saisit n'est pas celui qui valide.
    if me = old.entered_by then
      raise exception 'Celui qui saisit ne peut pas valider : demandez à un autre caissier.' using errcode = 'P0001';
    end if;
    if not private.has_permission('cash.manage') then
      raise exception 'Réservé aux caissiers.' using errcode = '42501';
    end if;
    new.checked_by := me;
    new.checked_at := now();
    if new.status = 'approved' and old.direction = 'out' and old.amount > 0 then
      select coalesce((value #>> '{}')::integer, 50000) into ceiling from public.settings where key = 'expense_ceiling';
      if old.amount > coalesce(ceiling, 50000) then
        new.status := 'awaiting_pastor';
      end if;
    end if;
  elsif old.status = 'awaiting_pastor' and new.status in ('approved', 'rejected') then
    if not private.has_permission('cash.approve') then
      raise exception 'Cette dépense dépasse le plafond : elle doit être approuvée par le pasteur.' using errcode = '42501';
    end if;
    new.approved_by := me;
    new.approved_at := now();
  else
    raise exception 'Changement de statut impossible.' using errcode = 'P0001';
  end if;

  if new.status = 'approved' then
    new.receipt_no := case when new.direction = 'in' and new.amount > 0 then 'CR-' when new.amount < 0 then 'CA-' else 'CD-' end
      || to_char(new.op_date, 'YYYY') || '-' || lpad(nextval('public.cash_receipt_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

create trigger cash_operations_guard before insert or update on public.cash_operations
  for each row execute function private.guard_cash_operation();

-- ===========================================================================
-- Droits
-- ===========================================================================
alter table public.cash_accounts enable row level security;
alter table public.campaigns enable row level security;
alter table public.pledges enable row level security;
alter table public.cash_operations enable row level security;
alter table public.offering_counts enable row level security;
alter table public.period_closings enable row level security;
alter table public.budgets enable row level security;

create or replace function private.cash_reader()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_permission('cash.manage') or private.has_permission('cash.view') or private.has_permission('cash.approve');
$$;

create policy "Lire les comptes" on public.cash_accounts for select to authenticated using (true);
create policy "Paramétrer les comptes" on public.cash_accounts for all to authenticated
  using ((select private.has_permission('settings.manage')) or (select private.has_permission('cash.manage')))
  with check ((select private.has_permission('settings.manage')) or (select private.has_permission('cash.manage')));

create policy "Lire les campagnes" on public.campaigns for select to authenticated using (true);
create policy "Gérer les campagnes" on public.campaigns for all to authenticated
  using ((select private.has_permission('cash.manage'))) with check ((select private.has_permission('cash.manage')));

create policy "Voir les engagements" on public.pledges for select to authenticated
  using (person_id = (select private.current_person_id()) or (select private.cash_reader()));
-- La caisse inscrit l'engagement devant le nom du fidèle ; le fidèle peut aussi s'engager lui-même.
create policy "Prendre un engagement" on public.pledges for insert to authenticated
  with check (
    (select private.has_permission('cash.manage'))
    or (person_id = (select private.current_person_id()) and anonymous_label is null)
  );

create policy "Voir les opérations" on public.cash_operations for select to authenticated
  using ((select private.cash_reader()) or person_id = (select private.current_person_id()));
create policy "Saisir une opération ou déclarer un don" on public.cash_operations for insert to authenticated
  with check (
    (select private.has_permission('cash.manage'))
    or (source = 'declaration' and direction = 'in' and person_id = (select private.current_person_id())
        and reverses_id is null and category in ('tithe', 'gift', 'thanksgiving', 'pledge'))
  );
create policy "Valider une opération" on public.cash_operations for update to authenticated
  using ((select private.has_permission('cash.manage')) or (select private.has_permission('cash.approve')))
  with check ((select private.has_permission('cash.manage')) or (select private.has_permission('cash.approve')));

create policy "Voir les comptages" on public.offering_counts for select to authenticated using ((select private.cash_reader()));
create policy "Compter une offrande" on public.offering_counts for insert to authenticated
  with check ((select private.has_permission('cash.manage')) and counter_1 = (select private.current_person_id()));

create policy "Voir les arrêtés" on public.period_closings for select to authenticated using ((select private.cash_reader()));
create policy "Voir les budgets" on public.budgets for select to authenticated using ((select private.cash_reader()));
create policy "Fixer les budgets" on public.budgets for all to authenticated
  using ((select private.has_permission('cash.manage'))) with check ((select private.has_permission('cash.manage')));

revoke all on public.cash_accounts, public.campaigns, public.pledges, public.cash_operations, public.offering_counts,
  public.period_closings, public.budgets from anon, authenticated;
grant select, insert, update on public.cash_accounts, public.campaigns to authenticated;
grant select, insert on public.pledges to authenticated;
grant select, insert on public.cash_operations to authenticated;
grant update (status, reason) on public.cash_operations to authenticated;
grant select, insert on public.offering_counts to authenticated;
grant select on public.period_closings to authenticated;
grant select, insert, update on public.budgets to authenticated;
grant all on public.cash_accounts, public.campaigns, public.pledges, public.cash_operations, public.offering_counts,
  public.period_closings, public.budgets to service_role;
grant usage on sequence public.cash_receipt_seq to authenticated, service_role;

-- ===========================================================================
-- Fonctions
-- ===========================================================================

-- Second compteur : confirme le comptage ; la recette est créée au nom du premier compteur
-- puis validée par le second (quatre yeux respectés).
create or replace function public.confirm_offering_count(p_count uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.offering_counts;
  me uuid := private.current_person_id();
  op uuid := gen_random_uuid();
begin
  if not private.has_permission('cash.manage') then
    raise exception 'Réservé aux caissiers.' using errcode = '42501';
  end if;
  select * into c from public.offering_counts where id = p_count and status = 'pending' for update;
  if c.id is null then
    raise exception 'Ce comptage a déjà été traité.' using errcode = 'P0001';
  end if;
  if c.counter_1 = me then
    raise exception 'Le second comptage doit être fait par une autre personne.' using errcode = 'P0001';
  end if;
  insert into public.cash_operations (id, account_id, direction, amount, category, label, op_date, source, entered_by)
  values (op, c.account_id, 'in', c.total, c.category, coalesce(c.service_label, 'Offrande'), c.op_date, 'count', c.counter_1);
  -- La saisie a été faite par le premier compteur : on la rattache à lui avant validation.
  update public.cash_operations set entered_by = c.counter_1 where id = op;
  update public.cash_operations set status = 'approved' where id = op;
  update public.offering_counts set counter_2 = me, status = 'confirmed', operation_id = op where id = p_count;
  return op;
end;
$$;

revoke all on function public.confirm_offering_count(uuid) from public, anon;
grant execute on function public.confirm_offering_count(uuid) to authenticated;

-- Soldes par compte à une date (opérations validées).
create or replace function public.cash_balances(p_until date default current_date)
returns table (account_id uuid, name text, kind text, balance bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.cash_reader() then
    raise exception 'Réservé à la caisse et au pasteur.' using errcode = '42501';
  end if;
  return query
  select a.id, a.name, a.kind,
         coalesce(sum(case when o.direction = 'in' then o.amount else -o.amount end), 0)::bigint
  from public.cash_accounts a
  left join public.cash_operations o on o.account_id = a.id and o.status = 'approved' and o.op_date <= p_until
  group by a.id, a.name, a.kind, a.position
  order by a.position;
end;
$$;

revoke all on function public.cash_balances(date) from public, anon;
grant execute on function public.cash_balances(date) to authenticated;

-- Rapport d'un mois : soldes d'ouverture et de clôture, recettes et dépenses par catégorie.
create or replace function public.month_report(p_month text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  first_day date := to_date(p_month || '-01', 'YYYY-MM-DD');
  last_day date := (to_date(p_month || '-01', 'YYYY-MM-DD') + interval '1 month - 1 day')::date;
begin
  if not private.cash_reader() then
    raise exception 'Réservé à la caisse et au pasteur.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'month', p_month,
    'opening', (select jsonb_agg(jsonb_build_object('name', b.name, 'balance', b.balance)) from public.cash_balances(first_day - 1) b),
    'closing', (select jsonb_agg(jsonb_build_object('name', b.name, 'balance', b.balance)) from public.cash_balances(last_day) b),
    'income', (select coalesce(jsonb_object_agg(category, total), '{}'::jsonb) from (
       select category, sum(amount) as total from public.cash_operations
       where status = 'approved' and direction = 'in' and op_date between first_day and last_day group by category) x),
    'expense', (select coalesce(jsonb_object_agg(category, total), '{}'::jsonb) from (
       select category, sum(amount) as total from public.cash_operations
       where status = 'approved' and direction = 'out' and op_date between first_day and last_day group by category) x),
    'pending', (select count(*) from public.cash_operations where status in ('pending', 'awaiting_pastor') and op_date between first_day and last_day),
    'closed', (select to_jsonb(pc) from public.period_closings pc where pc.month = p_month)
  );
end;
$$;

revoke all on function public.month_report(text) from public, anon;
grant execute on function public.month_report(text) to authenticated;

-- Arrêté mensuel : plus rien en attente, photo du rapport conservée, pasteur prévenu.
create or replace function public.close_month(p_month text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  first_day date := to_date(p_month || '-01', 'YYYY-MM-DD');
  last_day date := (to_date(p_month || '-01', 'YYYY-MM-DD') + interval '1 month - 1 day')::date;
  report jsonb;
begin
  if not private.has_permission('cash.manage') then
    raise exception 'Réservé aux caissiers.' using errcode = '42501';
  end if;
  if last_day >= current_date then
    raise exception 'Un mois ne s''arrête qu''une fois terminé.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.period_closings where month = p_month) then
    raise exception 'Ce mois est déjà arrêté.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.cash_operations where status in ('pending', 'awaiting_pastor') and op_date between first_day and last_day) then
    raise exception 'Des opérations de ce mois attendent encore une validation.' using errcode = 'P0001';
  end if;
  report := public.month_report(p_month);
  insert into public.period_closings (month, closed_by, summary) values (p_month, private.current_person_id(), report);

  insert into public.notifications (person_id, title, body, link, kind)
  select distinct ra.person_id, 'Rapport de caisse : ' || to_char(first_day, 'MM/YYYY'),
         'Le mois est arrêté. Le rapport est prêt.', '/caisse/rapports/' || p_month, 'cash'
  from public.role_assignments ra join public.roles r on r.id = ra.role_id
  where 'cash.view' = any (r.permissions) and ra.start_date <= current_date and (ra.end_date is null or ra.end_date >= current_date);
end;
$$;

revoke all on function public.close_month(text) from public, anon;
grant execute on function public.close_month(text) to authenticated;

-- Opération en attente : les autres caissiers (ou le pasteur) sont prévenus.
create or replace function private.notify_cash_pending()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare perm text;
begin
  if not ((tg_op = 'INSERT' and new.status = 'pending') or (tg_op = 'UPDATE' and new.status = 'awaiting_pastor' and old.status <> 'awaiting_pastor')) then
    return new;
  end if;
  perm := case when new.status = 'awaiting_pastor' then 'cash.approve' else 'cash.manage' end;
  insert into public.notifications (person_id, title, body, link, kind)
  select distinct ra.person_id,
         case when new.status = 'awaiting_pastor' then 'Dépense à approuver' when new.source = 'declaration' then 'Don déclaré à valider' else 'Opération à valider' end,
         new.amount || ' FCFA · ' || coalesce(new.label, new.category), '/caisse', 'cash'
  from public.role_assignments ra join public.roles r on r.id = ra.role_id
  where perm = any (r.permissions) and ra.start_date <= current_date and (ra.end_date is null or ra.end_date >= current_date)
    and ra.person_id is distinct from new.entered_by;
  return new;
end;
$$;

create trigger cash_operations_notify after insert or update on public.cash_operations
  for each row execute function private.notify_cash_pending();

-- Don ou dîme validé : le fidèle est remercié (et garde son reçu).
create or replace function private.notify_gift_outcome()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.person_id is not null and new.direction = 'in' and new.amount > 0
     and new.status in ('approved', 'rejected') and old.status <> new.status then
    insert into public.notifications (person_id, title, body, link, kind)
    values (new.person_id,
            case when new.status = 'approved' then 'Merci pour votre ' || case new.category when 'tithe' then 'dîme' when 'pledge' then 'versement' else 'don' end
                 else 'Don non reconnu' end,
            case when new.status = 'approved' then new.amount || ' FCFA reçus. Que Dieu vous bénisse.'
                 else coalesce(new.reason, 'Référence introuvable') || '. Contactez la caisse.' end,
            '/dons', 'cash');
  end if;
  return new;
end;
$$;

create trigger cash_operations_gift_outcome after update on public.cash_operations
  for each row execute function private.notify_gift_outcome();

-- Rappel aux caissiers le 1er du mois : arrêter le mois précédent (cron).
create or replace function public.notify_cash_closing(p_today date default current_date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer := 0;
  prev text := to_char(p_today - interval '1 month', 'YYYY-MM');
begin
  if extract(day from p_today) not in (1, 5) or exists (select 1 from public.period_closings where month = prev) then
    return 0;
  end if;
  insert into public.notifications (person_id, title, body, link, kind)
  select distinct ra.person_id, 'Arrêté de caisse', 'Le mois ' || prev || ' est terminé : vérifiez et arrêtez-le pour produire le rapport.', '/caisse/rapports', 'cash'
  from public.role_assignments ra join public.roles r on r.id = ra.role_id
  where 'cash.manage' = any (r.permissions) and ra.start_date <= p_today and (ra.end_date is null or ra.end_date >= p_today);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.notify_cash_closing(date) from public, anon, authenticated;
grant execute on function public.notify_cash_closing(date) to service_role;

-- Engagements : rappels (échéance dans 7 jours ou dépassée), chaque lundi ; signalement des
-- retards au père de famille si l'administrateur l'a activé (pledge_delay_notify_family_head).
create or replace function public.notify_pledge_reminders(p_today date default current_date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer := 0;
  m integer := 0;
  heads boolean;
begin
  if extract(isodow from p_today) <> 1 then
    return 0;
  end if;
  select coalesce((value #>> '{}')::boolean, false) into heads from public.settings where key = 'pledge_delay_notify_family_head';
  with status as (
    select p.id, p.person_id, p.amount, p.due_date, c.title,
           coalesce((select sum(o.amount) from public.cash_operations o where o.pledge_id = p.id and o.status = 'approved'), 0) as paid
    from public.pledges p join public.campaigns c on c.id = p.campaign_id and c.status = 'open'
    where p.person_id is not null and p.due_date is not null
  )
  insert into public.notifications (person_id, title, body, link, kind)
  select s.person_id,
         case when s.due_date < p_today then 'Engagement en retard' else 'Échéance proche' end,
         s.title || ' : reste ' || (s.amount - s.paid) || ' FCFA, échéance le ' || to_char(s.due_date, 'DD/MM') || '.',
         '/dons', 'pledge'
  from status s
  where s.paid < s.amount and s.due_date <= p_today + 7;
  get diagnostics n = row_count;

  if heads then
    insert into public.notifications (person_id, title, body, link, kind)
    select distinct gm2.person_id, 'Engagement en retard dans votre famille',
           pe.first_name || ' ' || pe.last_name || ' : ' || c.title, '/famille', 'pledge'
    from public.pledges p
    join public.campaigns c on c.id = p.campaign_id and c.status = 'open'
    join public.people pe on pe.id = p.person_id
    join public.group_memberships gm on gm.person_id = p.person_id and gm.end_date is null
    join public.groups g on g.id = gm.group_id join public.group_types gt on gt.id = g.type_id and gt.slug = 'family'
    join public.group_memberships gm2 on gm2.group_id = g.id and gm2.end_date is null
    join public.group_functions f on f.id = gm2.function_id and f.rank = 1
    where p.due_date < p_today
      and p.amount > coalesce((select sum(o.amount) from public.cash_operations o where o.pledge_id = p.id and o.status = 'approved'), 0);
    get diagnostics m = row_count;
  end if;
  return n + m;
end;
$$;

revoke all on function public.notify_pledge_reminders(date) from public, anon, authenticated;
grant execute on function public.notify_pledge_reminders(date) to service_role;

-- Suivi des engagements (noms seulement), pour la caisse et le pasteur.
create or replace function public.pledge_overview(p_campaign uuid)
returns table (pledge_id uuid, person_id uuid, name text, phone text, amount integer, due_date date, paid bigint, pending bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.cash_reader() then
    raise exception 'Réservé à la caisse et au pasteur.' using errcode = '42501';
  end if;
  return query
  select p.id, p.person_id,
         coalesce(upper(pe.last_name) || ' ' || pe.first_name, p.anonymous_label),
         coalesce(pe.whatsapp, pe.phone),
         p.amount, p.due_date,
         coalesce((select sum(o.amount) from public.cash_operations o where o.pledge_id = p.id and o.status = 'approved'), 0)::bigint,
         coalesce((select sum(o.amount) from public.cash_operations o where o.pledge_id = p.id and o.status in ('pending', 'awaiting_pastor')), 0)::bigint
  from public.pledges p
  left join public.people pe on pe.id = p.person_id
  where p.campaign_id = p_campaign
  order by 3;
end;
$$;

revoke all on function public.pledge_overview(uuid) from public, anon;
grant execute on function public.pledge_overview(uuid) to authenticated;

-- ===========================================================================
-- Justificatifs (photos) : stockage privé
-- ===========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('justificatifs', 'justificatifs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy "Caisse : déposer un justificatif" on storage.objects for insert to authenticated
  with check (bucket_id = 'justificatifs' and (select private.has_permission('cash.manage')));
create policy "Caisse : lire les justificatifs" on storage.objects for select to authenticated
  using (bucket_id = 'justificatifs' and (select private.cash_reader()));

-- Modules : Caisse (caissiers, pasteur) et Dons (tous : mes dons, dîmes, engagements).
insert into public.modules (code, label, description, icon, href, enabled, home_position, nav_position, required_permissions, required_scope) values
  ('cash', 'Caisse', 'Offrandes, dîmes, dépenses, engagements, arrêtés et rapports', 'wallet', '/caisse', true, null, null, '{cash.manage,cash.view,cash.approve}', 'church')
on conflict (code) do update set enabled = true, href = excluded.href, required_permissions = excluded.required_permissions, required_scope = excluded.required_scope;

update public.modules set enabled = true, href = '/dons',
  description = 'Mes dons, mes dîmes et mes engagements envers l''église. À ne pas confondre avec les cotisations de famille ou de groupe.'
where code = 'giving';
