-- Décision de Jean-Pierre (09/11/2026) : la dîme est vue par le PASTEUR SEUL — détail, totaux, bilan.
-- Elle quitte la caisse de l'église : ni trésorier, ni caissiers, ni administrateur, ni assistants
-- ne la voient, même en total. Table dédiée, droit dédié attribué au seul rôle Pasteur.

insert into public.permissions (code, label, description, position) values
  ('tithes.view', 'Voir les dîmes', 'Dîmes : détail, totaux et bilan. Réservé au pasteur.', 32)
on conflict (code) do nothing;

-- Le droit n'appartient qu'au rôle Pasteur ; retiré de tout autre rôle s'il y avait été ajouté.
update public.roles set permissions = array_remove(permissions, 'tithes.view') where code <> 'pastor';
update public.roles set permissions = array(select distinct unnest(permissions || '{tithes.view}')) where code = 'pastor';

insert into public.settings (key, label, value, is_public)
values ('tithe_phone', 'Numéro Mobile Money du pasteur pour les dîmes', '"+2250707624631"', true)
on conflict (key) do nothing;

create table public.tithes (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete restrict,
  amount integer not null check (amount > 0),
  tithe_date date not null default current_date,
  method text not null,                 -- liste « payment_method »
  reference text,
  anonymous boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'received', 'not_received')),
  pastor_note text,
  created_at timestamptz not null default now(),
  confirmed_by uuid references public.people (id) on delete set null,
  confirmed_at timestamptz
);

create index tithes_person_idx on public.tithes (person_id);
create index tithes_date_idx on public.tithes (tithe_date);

-- Pas de journal général (lisible des assistants) : la table garde elle-même qui a déclaré, qui a
-- confirmé et quand ; une dîme confirmée ne se modifie plus et rien ne s'efface.
create or replace function private.guard_tithe()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.confirmed_by := null;
    new.confirmed_at := null;
    return new;
  end if;
  if old.status <> 'pending' then
    raise exception 'Cette dîme a déjà été traitée.' using errcode = 'P0001';
  end if;
  if new.amount <> old.amount or new.person_id <> old.person_id or new.tithe_date <> old.tithe_date then
    raise exception 'Le montant, la personne et la date ne se modifient pas.' using errcode = 'P0001';
  end if;
  new.confirmed_by := private.current_person_id();
  new.confirmed_at := now();
  return new;
end;
$$;

create trigger tithes_guard before insert or update on public.tithes for each row execute function private.guard_tithe();

alter table public.tithes enable row level security;
create policy "Dîmes : le pasteur, et chacun les siennes" on public.tithes for select to authenticated
  using ((select private.has_permission('tithes.view')) or person_id = (select private.current_person_id()));
create policy "Dîmes : déclarer la sienne" on public.tithes for insert to authenticated
  with check (person_id = (select private.current_person_id()));
create policy "Dîmes : le pasteur confirme" on public.tithes for update to authenticated
  using ((select private.has_permission('tithes.view'))) with check ((select private.has_permission('tithes.view')));
revoke all on public.tithes from anon, authenticated;
grant select, insert on public.tithes to authenticated;
grant update (status, pastor_note) on public.tithes to authenticated;
grant all on public.tithes to service_role;

-- Nouvelle dîme déclarée : seul le pasteur est prévenu (sans montant dans le titre).
create or replace function private.notify_tithe()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (person_id, title, body, link, kind)
  select distinct ra.person_id, 'Dîme à confirmer', 'Une dîme a été déclarée : vérifiez sa réception.', '/dimes', 'tithe'
  from public.role_assignments ra join public.roles r on r.id = ra.role_id
  where 'tithes.view' = any (r.permissions) and ra.start_date <= current_date and (ra.end_date is null or ra.end_date >= current_date);
  return new;
end;
$$;

create trigger tithes_notify after insert on public.tithes for each row execute function private.notify_tithe();

-- Bilan des dîmes (pasteur seul) : totaux par mois sur une année.
create or replace function public.tithe_report(p_year integer)
returns table (month integer, received bigint, pending bigint, givers bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('tithes.view') then
    raise exception 'Réservé au pasteur.' using errcode = '42501';
  end if;
  return query
  select extract(month from t.tithe_date)::integer,
         coalesce(sum(t.amount) filter (where t.status = 'received'), 0)::bigint,
         coalesce(sum(t.amount) filter (where t.status = 'pending'), 0)::bigint,
         count(distinct t.person_id) filter (where t.status = 'received')
  from public.tithes t
  where extract(year from t.tithe_date) = p_year
  group by 1 order by 1;
end;
$$;

revoke all on function public.tithe_report(integer) from public, anon;
grant execute on function public.tithe_report(integer) to authenticated;

-- Reprise de l'existant : les dîmes déclarées dans la caisse passent chez le pasteur.
insert into public.tithes (person_id, amount, tithe_date, method, reference, anonymous, created_at)
select person_id, amount, op_date, coalesce(method, 'cash'), reference, anonymous, created_at
from public.cash_operations
where category = 'tithe' and person_id is not null and amount > 0 and status in ('pending', 'awaiting_pastor');

-- Elles ne doivent plus rester dans la caisse (déclarations en attente, jamais validées).
delete from public.cash_operations where category = 'tithe' and status in ('pending', 'awaiting_pastor') and reverses_id is null;

-- Les anciennes traces de dîmes dans le journal ne sont plus lisibles que par le pasteur
-- (le journal ne se modifie ni ne s'efface : on restreint seulement sa lecture).
drop policy if exists "Lire le journal" on public.audit_log;
create policy "Lire le journal" on public.audit_log for select to authenticated
  using ((select private.has_permission('audit.view'))
         and (table_name <> 'cash_operations'
              or coalesce(after ->> 'category', before ->> 'category', '') <> 'tithe'
              or (select private.has_permission('tithes.view'))));

-- La caisse de l'église n'accepte plus de dîme.
alter table public.cash_operations add constraint cash_operations_no_tithe check (category <> 'tithe') not valid;
drop policy if exists "Saisir une opération ou déclarer un don" on public.cash_operations;
create policy "Saisir une opération ou déclarer un don" on public.cash_operations for insert to authenticated
  with check ((select private.has_permission('cash.manage'))
              or (source = 'declaration' and direction = 'in' and person_id = (select private.current_person_id())
                  and reverses_id is null and category = any (array['gift', 'offering', 'thanksgiving', 'pledge'])));

update public.value_lists set active = false where list_code = 'income_category' and value = 'tithe';

-- Onglet « Mes dîmes » du pasteur.
insert into public.modules (code, label, description, icon, href, enabled, home_position, nav_position, required_permissions, required_scope,
                            hero_title, verse_text, verse_ref)
values ('tithes', 'Dîmes', 'Les dîmes reçues : visibles du pasteur seul', 'hand-heart', '/dimes', true, null, null, '{tithes.view}', 'church',
        'Les dîmes', 'Apportez à la maison du trésor toutes les dîmes.', 'Malachie 3:10')
on conflict (code) do update set enabled = true, href = excluded.href, required_permissions = excluded.required_permissions,
  required_scope = excluded.required_scope;
