-- Lot 0 bis — Accueil animé : tout ce qu'affiche l'accueil se configure.
--
-- settings       : paramètres clé → valeur (identité de l'église, phrase d'accueil…)
-- service_types  : cultes récurrents (jour, heures, lieu) → carte « Prochain culte »
-- daily_verses   : versets qui tournent chaque jour → carte « Verset du jour »
-- modules        : modules de l'application, activables → raccourcis de l'accueil
--
-- Lecture : toute personne connectée (settings : seulement les clés publiques).
-- Écriture : aucune règle pour l'instant ; l'administration arrive au lot 1
-- avec les rôles. D'ici là, seul le serveur (clé secrète) peut modifier.

-- ---------------------------------------------------------------------------
-- settings
-- ---------------------------------------------------------------------------
create table public.settings (
  key text primary key,
  value jsonb not null,
  label text not null,
  -- Visible de toute personne connectée. Les seuils, plafonds et options
  -- internes resteront privés (false).
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on table public.settings is 'Paramètres administrables (clé → valeur JSON).';

create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- service_types (docs/02 §4.3)
-- ---------------------------------------------------------------------------
create table public.service_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text,
  -- 0 = dimanche … 6 = samedi (comme Date.getUTCDay)
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  place text,
  recurring boolean not null default true,
  positions jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null
);

comment on table public.service_types is 'Types de culte récurrents (jour, horaires, postes à pourvoir).';

create trigger service_types_set_updated_at
  before update on public.service_types
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- daily_verses
-- ---------------------------------------------------------------------------
create table public.daily_verses (
  id uuid primary key default gen_random_uuid(),
  reference text not null,
  text text not null,
  translation text not null default 'Louis Segond 1910',
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null
);

comment on table public.daily_verses is 'Versets affichés à tour de rôle, un par jour.';

create trigger daily_verses_set_updated_at
  before update on public.daily_verses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- modules (docs/02 §4.1)
-- ---------------------------------------------------------------------------
create table public.modules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  description text,
  -- Nom d'icône Lucide en kebab-case (ex. « calendar-days »)
  icon text not null default 'sparkles',
  href text,
  enabled boolean not null default false,
  -- Ordre sur l'accueil ; null = absent de l'accueil
  home_position integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on table public.modules is 'Modules de l''application, activables, et raccourcis de l''accueil.';

create trigger modules_set_updated_at
  before update on public.modules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Sécurité
-- ---------------------------------------------------------------------------
alter table public.settings enable row level security;
alter table public.service_types enable row level security;
alter table public.daily_verses enable row level security;
alter table public.modules enable row level security;

create policy "Les personnes connectées lisent les paramètres publics"
  on public.settings for select to authenticated
  using (is_public);

create policy "Les personnes connectées lisent les cultes actifs"
  on public.service_types for select to authenticated
  using (active and deleted_at is null);

create policy "Les personnes connectées lisent les versets actifs"
  on public.daily_verses for select to authenticated
  using (active and deleted_at is null);

create policy "Les personnes connectées lisent les modules"
  on public.modules for select to authenticated
  using (true);

revoke all on public.settings, public.service_types, public.daily_verses, public.modules
  from anon, authenticated;
grant select on public.settings, public.service_types, public.daily_verses, public.modules
  to authenticated;
grant all on public.settings, public.service_types, public.daily_verses, public.modules
  to service_role;

-- ---------------------------------------------------------------------------
-- Valeurs initiales (docs/05) — toutes modifiables ensuite
-- ---------------------------------------------------------------------------
insert into public.settings (key, label, is_public, value) values
  ('church_profile', 'Identité de l''église', true, jsonb_build_object(
    'name', 'Église évangélique Les Semeurs de la Parole',
    'short_name', 'Les Semeurs de la Parole',
    'tagline', 'La Parole de Dieu, une semence pour aujourd''hui et pour demain',
    'welcome_message', 'Jésus-Christ t''aime. Nous n''attendons plus que toi.',
    'address', 'Yopougon, Camp Militaire, carrefour Gandhi, Abidjan',
    'email', 'lessemeursdelaparole@gmail.com',
    'phones', jsonb_build_array('05 06 32 52 43', '07 08 31 04 33', '07 78 01 66 95')
  ))
on conflict (key) do nothing;

insert into public.service_types (name, short_name, weekday, start_time, end_time, place, positions) values
  ('Moment de prières et d''enseignements', 'Culte du vendredi', 5, '18:00', '20:00',
   'Yopougon, Camp Militaire, carrefour Gandhi',
   '["Modérateur", "Prédicateur", "Louange", "Protocole", "Intercession"]'),
  ('Culte d''actions de grâces', 'Culte du dimanche', 0, '09:00', '12:00',
   'Yopougon, Camp Militaire, carrefour Gandhi',
   '["Modérateur", "Prédicateur", "Louange", "Protocole", "Intercession"]');

insert into public.daily_verses (position, reference, text) values
  (1, 'Psaume 119:105', 'Ta parole est une lampe à mes pieds, et une lumière sur mon sentier.'),
  (2, 'Luc 8:11', 'La semence, c''est la parole de Dieu.'),
  (3, 'Ésaïe 40:31', 'Mais ceux qui se confient en l''Éternel renouvellent leur force. Ils prennent le vol comme les aigles ; ils courent, et ne se lassent point, ils marchent, et ne se fatiguent point.'),
  (4, 'Galates 6:9', 'Ne nous lassons pas de faire le bien ; car nous moissonnerons au temps convenable, si nous ne nous relâchons pas.'),
  (5, 'Jean 3:16', 'Car Dieu a tant aimé le monde qu''il a donné son Fils unique, afin que quiconque croit en lui ne périsse point, mais qu''il ait la vie éternelle.'),
  (6, 'Philippiens 4:13', 'Je puis tout par celui qui me fortifie.'),
  (7, 'Psaume 23:1', 'L''Éternel est mon berger : je ne manquerai de rien.'),
  (8, 'Matthieu 11:28', 'Venez à moi, vous tous qui êtes fatigués et chargés, et je vous donnerai du repos.'),
  (9, 'Proverbes 3:5', 'Confie-toi en l''Éternel de tout ton cœur, et ne t''appuie pas sur ta sagesse.'),
  (10, '2 Corinthiens 9:6', 'Celui qui sème peu moissonnera peu, et celui qui sème abondamment moissonnera abondamment.'),
  (11, 'Romains 8:28', 'Nous savons, du reste, que toutes choses concourent au bien de ceux qui aiment Dieu.'),
  (12, 'Josué 1:9', 'Fortifie-toi et prends courage ! Ne t''effraie point et ne t''épouvante point, car l''Éternel, ton Dieu, est avec toi dans tout ce que tu entreprendras.');

-- Raccourcis de l'accueil : modules prévus au cahier des charges, désactivés
-- jusqu'à leur livraison (ils s'affichent alors « Bientôt »).
insert into public.modules (code, label, description, icon, href, enabled, home_position) values
  ('family', 'Ma famille', 'Suivi des fidèles et des absences', 'users-round', '/famille', false, 1),
  ('services', 'Cultes', 'Programme, modérateurs et prédicateurs', 'calendar-days', '/cultes', false, 2),
  ('sermons', 'Prédications', 'Écouter et réécouter les messages', 'book-open', '/predications', false, 3),
  ('prayer', 'Prière', 'Déposer un sujet de prière', 'hand-heart', '/priere', false, 4),
  ('messages', 'Messages', 'Annonces et nouvelles de l''église', 'megaphone', '/messages', false, 5),
  ('giving', 'Mes dons', 'Cotisations, engagements et reçus', 'heart-handshake', '/dons', false, 6)
on conflict (code) do nothing;
