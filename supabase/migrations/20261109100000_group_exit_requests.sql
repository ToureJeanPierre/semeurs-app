-- Retirer un membre d'une famille ou d'une équipe : option B choisie par Jean-Pierre (09/11/2026).
-- Le responsable du groupe demande, avec un motif ; l'administration (ou le pasteur) valide ou refuse.
-- Personne ne sort d'une famille sans validation ; tout reste dans l'historique.

insert into public.value_lists (list_code, value, label, position) values
  ('group_exit_reason', 'moved', 'A déménagé loin', 1),
  ('group_exit_reason', 'other_family', 'Doit rejoindre une autre famille', 2),
  ('group_exit_reason', 'inactive', 'Ne vient plus depuis longtemps', 3),
  ('group_exit_reason', 'left', 'A quitté l''église', 4),
  ('group_exit_reason', 'deceased', 'Décédé(e)', 5),
  ('group_exit_reason', 'mistake', 'Inscrit(e) par erreur', 6)
on conflict (list_code, value) do nothing;

create table public.group_exit_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  reason text not null check (length(trim(reason)) >= 3),
  requested_by uuid references public.people (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references public.people (id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);

create unique index group_exit_requests_pending_uniq on public.group_exit_requests (group_id, person_id) where status = 'pending';

create trigger group_exit_requests_audit after insert or update or delete on public.group_exit_requests
  for each row execute function private.audit();

-- Qui décide : l'administration des groupes ou ceux qui gèrent les fiches de toute l'église (pasteur).
create or replace function private.decides_group_exits()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_permission('groups.manage') or private.has_permission('people.manage');
$$;

revoke all on function private.decides_group_exits() from public, anon;
grant execute on function private.decides_group_exits() to authenticated;

alter table public.group_exit_requests enable row level security;
create policy "Voir les demandes de retrait" on public.group_exit_requests for select to authenticated
  using ((select private.decides_group_exits())
         or requested_by = (select private.current_person_id())
         or (select private.has_permission('people.manage', group_id))
         or (select private.has_permission('groups.manage', group_id)));
create policy "Demander un retrait" on public.group_exit_requests for insert to authenticated
  with check (
    requested_by = (select private.current_person_id())
    and status = 'pending'
    and ((select private.has_permission('people.manage', group_id)) or (select private.has_permission('groups.manage', group_id)))
    and exists (select 1 from public.group_memberships gm where gm.group_id = group_exit_requests.group_id
                and gm.person_id = group_exit_requests.person_id and gm.end_date is null)
  );
revoke all on public.group_exit_requests from anon, authenticated;
grant select, insert on public.group_exit_requests to authenticated;
grant all on public.group_exit_requests to service_role;

-- Nouvelle demande : ceux qui décident sont prévenus.
create or replace function private.notify_group_exit_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare who text; grp text;
begin
  select first_name || ' ' || last_name into who from public.people where id = new.person_id;
  select name into grp from public.groups where id = new.group_id;
  insert into public.notifications (person_id, title, body, link, kind)
  select distinct ra.person_id, 'Demande de retrait', who || ' (' || grp || ') : ' || new.reason || '.', '/administration/demandes', 'exit_request'
  from public.role_assignments ra join public.roles r on r.id = ra.role_id
  where ra.scope_type = 'church' and ra.start_date <= current_date and (ra.end_date is null or ra.end_date >= current_date)
    and (r.permissions && array['groups.manage', 'people.manage'])
    and ra.person_id is distinct from new.requested_by;
  return new;
end;
$$;

create trigger group_exit_requests_notify after insert on public.group_exit_requests
  for each row execute function private.notify_group_exit_request();

-- Décision : validée → la personne quitte le groupe (historique gardé) ; le demandeur est prévenu.
create or replace function public.decide_group_exit(p_request uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  req public.group_exit_requests;
  who text;
begin
  if not private.decides_group_exits() then
    raise exception 'Réservé à l''administration et au pasteur.' using errcode = '42501';
  end if;
  select * into req from public.group_exit_requests where id = p_request for update;
  if req.id is null or req.status <> 'pending' then
    raise exception 'Cette demande a déjà été traitée.' using errcode = 'P0001';
  end if;
  update public.group_exit_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      decided_by = private.current_person_id(), decided_at = now(), decision_note = nullif(trim(p_note), '')
  where id = p_request;
  if p_approve then
    update public.group_memberships set end_date = current_date, function_id = null
    where group_id = req.group_id and person_id = req.person_id and end_date is null;
  end if;
  select first_name || ' ' || last_name into who from public.people where id = req.person_id;
  if req.requested_by is not null then
    insert into public.notifications (person_id, title, body, link, kind)
    values (req.requested_by,
            case when p_approve then 'Retrait accepté' else 'Retrait refusé' end,
            who || case when p_approve then ' ne fait plus partie du groupe.' else ' reste dans le groupe.' end
              || coalesce(' ' || nullif(trim(p_note), ''), ''),
            '/famille', 'exit_request');
  end if;
end;
$$;

revoke all on function public.decide_group_exit(uuid, boolean, text) from public, anon;
grant execute on function public.decide_group_exit(uuid, boolean, text) to authenticated;
