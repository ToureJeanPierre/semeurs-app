-- Caisse : une opération encore en attente peut être complétée (libellé, référence) sans
-- changer de statut ; montant, compte, sens, date et catégorie restent figés.
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

  if old.status in ('approved', 'rejected') then
    raise exception 'Une opération validée ou refusée ne se modifie plus : annulez-la par une contre-opération.' using errcode = 'P0001';
  end if;
  if new.amount <> old.amount or new.account_id <> old.account_id or new.direction <> old.direction
     or new.op_date <> old.op_date or new.category <> old.category or new.person_id is distinct from old.person_id then
    raise exception 'Seul le statut d''une opération en attente peut changer.' using errcode = 'P0001';
  end if;
  if new.status = old.status then
    return new;
  end if;
  if new.status = 'rejected' and length(trim(coalesce(new.reason, ''))) < 5 then
    raise exception 'Indiquez le motif du refus.' using errcode = 'P0001';
  end if;

  if old.status = 'pending' and new.status in ('approved', 'awaiting_pastor', 'rejected') then
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
    new.receipt_no := case when new.amount < 0 then 'CA-' when new.direction = 'in' then 'CR-' else 'CD-' end
      || to_char(new.op_date, 'YYYY') || '-' || lpad(nextval('public.cash_receipt_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;
