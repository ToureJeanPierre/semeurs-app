-- Notifications sur le téléphone (Web Push, gratuit) : chaque notification enregistrée dans
-- l'appli est aussi envoyée aux téléphones de la personne qui l'ont autorisé.
--
-- push_subscriptions : un téléphone (navigateur) abonné par ligne ; chacun ne voit que les siens
-- private.app_config : adresse de l'appli et secret partagé avec /api/push (rempli hors Git,
--                      directement en base : le secret n'est jamais dans le dépôt)
-- Un déclencheur appelle /api/push (extension pg_net, asynchrone) à chaque notification.

create extension if not exists pg_net with schema extensions;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index push_subscriptions_person_idx on public.push_subscriptions (person_id);

alter table public.push_subscriptions enable row level security;
create policy "Mes téléphones abonnés" on public.push_subscriptions for all to authenticated
  using (person_id = (select private.current_person_id()))
  with check (person_id = (select private.current_person_id()));
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;

create table if not exists private.app_config (
  key text primary key,
  value text not null
);
revoke all on private.app_config from public, anon, authenticated;

create or replace function private.push_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  url text;
  secret text;
begin
  select value into url from private.app_config where key = 'app_url';
  select value into secret from private.app_config where key = 'push_webhook_secret';
  if url is null or secret is null
     or not exists (select 1 from public.push_subscriptions where person_id = new.person_id) then
    return new;
  end if;
  perform net.http_post(
    url := url || '/api/push',
    body := jsonb_build_object('person_id', new.person_id, 'title', new.title, 'body', new.body, 'link', new.link, 'tag', new.kind),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

create trigger notifications_push after insert on public.notifications
  for each row execute function private.push_notification();
