-- Discussion de groupe (demande de Jean-Pierre, 29/10/2026 : « les liens de fraternité doivent
-- être développés ») : une conversation par famille, équipe, cellule… comme un groupe WhatsApp,
-- propre à l'église. Capacité « chat », cochée d'office ; l'administrateur peut la retirer.
-- Les nouveaux membres voient la conversation dès leur arrivée. Pas de notification par
-- message (pour ne pas importuner) : un compteur « non lus » s'affiche.

insert into public.capabilities (code, label, description, available, position)
values ('chat', 'Discussion', 'Conversation entre les membres du groupe', true, 0)
on conflict (code) do update set available = true;

update public.group_types set default_capabilities = array(select distinct unnest(default_capabilities || '{chat}'))
where slug in ('family', 'team', 'cell', 'youth');

insert into public.group_capabilities (group_id, capability_code)
select g.id, 'chat' from public.groups g join public.group_types gt on gt.id = g.type_id
where gt.slug in ('family', 'team', 'cell', 'youth') and g.deleted_at is null
on conflict do nothing;

create table public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  author_id uuid not null references public.people (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.people (id) on delete set null
);

create index group_messages_group_idx on public.group_messages (group_id, created_at desc);

-- Dernière lecture de chacun (compteur « non lus »).
create table public.group_reads (
  group_id uuid not null references public.groups (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (group_id, person_id)
);

create or replace function private.chat_enabled(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.group_capabilities where group_id = p_group and capability_code = 'chat');
$$;

alter table public.group_messages enable row level security;
alter table public.group_reads enable row level security;

-- Seuls les membres du groupe (et ses responsables) lisent et écrivent.
create policy "Lire la discussion du groupe" on public.group_messages for select to authenticated
  using ((select private.is_group_member(group_id)) or (select private.has_permission('groups.manage', group_id)));
create policy "Écrire dans la discussion" on public.group_messages for insert to authenticated
  with check (
    author_id = (select private.current_person_id())
    and (select private.is_group_member(group_id))
    and (select private.chat_enabled(group_id))
  );
-- Retirer un message : son auteur, ou un responsable du groupe (modération).
create policy "Retirer un message" on public.group_messages for update to authenticated
  using (author_id = (select private.current_person_id()) or (select private.has_permission('groups.manage', group_id)))
  with check (author_id = (select private.current_person_id()) or (select private.has_permission('groups.manage', group_id)));

create policy "Ma dernière lecture" on public.group_reads for all to authenticated
  using (person_id = (select private.current_person_id()))
  with check (person_id = (select private.current_person_id()));

revoke all on public.group_messages, public.group_reads from anon, authenticated;
grant select, insert on public.group_messages to authenticated;
grant update (deleted_at, deleted_by) on public.group_messages to authenticated;
grant select, insert, update on public.group_reads to authenticated;
grant all on public.group_messages, public.group_reads to service_role;

create trigger group_messages_audit after insert or update or delete on public.group_messages
  for each row execute function private.audit();

-- Messages en temps réel (les règles RLS s'appliquent aussi au temps réel).
alter publication supabase_realtime add table public.group_messages;

-- Non lus par groupe, pour la personne connectée.
create or replace function public.my_unread_messages()
returns table (group_id uuid, unread integer)
language sql
stable
security definer
set search_path = ''
as $$
  select gm.group_id, count(m.id)::integer
  from public.group_memberships gm
  join public.group_messages m on m.group_id = gm.group_id and m.deleted_at is null
    and m.author_id <> gm.person_id
    and m.created_at > coalesce((select r.last_read_at from public.group_reads r where r.group_id = gm.group_id and r.person_id = gm.person_id), gm.created_at)
  where gm.person_id = private.current_person_id() and gm.end_date is null
  group by gm.group_id;
$$;

revoke all on function public.my_unread_messages() from public, anon;
grant execute on function public.my_unread_messages() to authenticated;
