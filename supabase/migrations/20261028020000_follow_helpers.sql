-- Fonction exposée à l'interface : la personne connectée peut-elle suivre ce fidèle
-- (noter un contact, voir son alerte) ? La sécurité reste dans les règles RLS.
create or replace function public.can_follow_person(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_follow_person(target);
$$;

revoke all on function public.can_follow_person(uuid) from public, anon;
grant execute on function public.can_follow_person(uuid) to authenticated;
