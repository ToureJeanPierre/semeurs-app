-- Cotisations : le fidèle est prévenu quand son reçu est prêt (versement validé),
-- ou quand sa déclaration est refusée (avec le motif).
create or replace function private.notify_payment_outcome()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare h_title text;
begin
  if new.amount <= 0 then
    return new;
  end if;
  if (tg_op = 'INSERT' and new.status = 'validated')
     or (tg_op = 'UPDATE' and old.status = 'declared' and new.status in ('validated', 'rejected')) then
    select title into h_title from public.contribution_headings where id = new.heading_id;
    insert into public.notifications (person_id, title, body, link, kind)
    values (
      new.person_id,
      case when new.status = 'validated' then 'Reçu n° ' || new.receipt_no else 'Versement non reconnu' end,
      case when new.status = 'validated'
           then 'Merci pour votre versement de ' || new.amount || ' FCFA (« ' || h_title || ' »).'
           else '« ' || h_title || ' » : ' || coalesce(new.reason, 'déclaration refusée') || '. Contactez la trésorière.' end,
      case when new.status = 'validated' then '/cotisations/recu/' || new.id else '/cotisations' end,
      'contribution'
    );
  end if;
  return new;
end;
$$;

create trigger contribution_payments_outcome after insert or update on public.contribution_payments
  for each row execute function private.notify_payment_outcome();
