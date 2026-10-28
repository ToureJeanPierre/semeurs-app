-- Sujets de prière confidentiels : seuls l'auteur, le pasteur (droit « followups.confidential »)
-- et les responsables d'un groupe d'intercession (fonction dans CE groupe) les voient.
-- Un droit d'église « groups.manage » (administrateur) ne suffit pas.
create or replace function private.leads_prayer_chain()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_capabilities gc
    where gc.capability_code = 'prayer_chain'
      and gc.group_id in (select private.groups_with_permission('groups.manage'))
  );
$$;
