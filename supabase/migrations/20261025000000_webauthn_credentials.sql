-- Lot 0 — Clés d'accès (empreinte, schéma ou code du téléphone).
--
-- On ne stocke que la clé PUBLIQUE : l'empreinte et le schéma ne quittent
-- jamais le téléphone. L'écriture se fait uniquement côté serveur (clé secrète),
-- après vérification cryptographique. La personne peut voir et retirer ses clés.

create table public.webauthn_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,          -- clé publique COSE encodée en base64url
  counter bigint not null default 0, -- compteur anti-clonage
  transports text[],
  device_label text not null default 'Appareil',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz
);

comment on table public.webauthn_credentials is
  'Clés d''accès (passkeys) des comptes : déverrouillage par empreinte ou schéma.';

create index webauthn_credentials_user_id_idx on public.webauthn_credentials (user_id);

-- Mise à jour automatique de updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger webauthn_credentials_set_updated_at
  before update on public.webauthn_credentials
  for each row execute function public.set_updated_at();

-- Sécurité : RLS activé, chacun ne voit et ne retire que ses propres clés.
alter table public.webauthn_credentials enable row level security;

create policy "Chacun voit ses propres clés d'accès"
  on public.webauthn_credentials for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Chacun peut retirer ses propres clés d'accès"
  on public.webauthn_credentials for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- Aucune politique INSERT / UPDATE : seul le serveur (clé secrète) écrit.
-- Les nouvelles tables ne sont pas exposées automatiquement : on accorde
-- explicitement le strict nécessaire.
revoke all on public.webauthn_credentials from anon, authenticated;
grant select, delete on public.webauthn_credentials to authenticated;
grant all on public.webauthn_credentials to service_role;
