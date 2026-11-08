-- Bannières animées de l'accueil (demande de Jean-Pierre du 08/11/2026) : messages qui se succèdent
-- automatiquement (texte, image, appel à l'action), avec effets combinés. Tout se règle dans
-- Administration → Bannières de l'accueil : textes, image, couleurs, effet, durée, période, ordre.

insert into public.permissions (code, label, description, position) values
  ('promos.manage', 'Gérer les bannières de l''accueil', 'Créer, ordonner et programmer les bannières animées', 31)
on conflict (code) do nothing;

update public.roles set permissions = array(select distinct unnest(permissions || '{promos.manage}'))
where code in ('pastor', 'assistant_pastor', 'admin');

insert into public.value_lists (list_code, value, label, position) values
  ('promo_theme', 'royal', 'Bleu roi', 1),
  ('promo_theme', 'gold', 'Or', 2),
  ('promo_theme', 'green', 'Vert', 3),
  ('promo_theme', 'violet', 'Violet', 4),
  ('promo_theme', 'sunset', 'Coucher de soleil', 5),
  ('promo_theme', 'night', 'Nuit étoilée', 6),
  ('promo_effect', 'mix', 'Combiné (varie à chaque passage)', 1),
  ('promo_effect', 'zoom', 'Zoom', 2),
  ('promo_effect', 'slide', 'Glissement', 3),
  ('promo_effect', 'flip', 'Rotation 3D', 4),
  ('promo_effect', 'fade', 'Fondu', 5)
on conflict (list_code, value) do nothing;

create table public.promo_slides (
  id uuid primary key default gen_random_uuid(),
  eyebrow text,                                   -- petite étiquette : « Nouveau », « Ce dimanche »…
  title text not null check (length(trim(title)) >= 2),
  subtitle text,
  cta_label text,
  cta_href text check (cta_href is null or cta_href ~ '^(/|https://)'),
  image_url text check (image_url is null or image_url ~ '^(/|https://)'),  -- illustration de l'appli
  image_path text,                                -- ou image envoyée (stockage « affiches »)
  theme text not null default 'royal',            -- liste « promo_theme »
  effect text not null default 'mix',             -- liste « promo_effect »
  duration_seconds integer not null default 6 check (duration_seconds between 3 and 20),
  starts_on date,
  ends_on date,
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create trigger promo_slides_audit after insert or update or delete on public.promo_slides
  for each row execute function private.audit();

alter table public.promo_slides enable row level security;
create policy "Voir les bannières" on public.promo_slides for select to authenticated using (true);
create policy "Gérer les bannières" on public.promo_slides for all to authenticated
  using ((select private.has_permission('promos.manage'))) with check ((select private.has_permission('promos.manage')));
revoke all on public.promo_slides from anon, authenticated;
grant select, insert, update, delete on public.promo_slides to authenticated;
grant all on public.promo_slides to service_role;

-- Les images des bannières vont dans le même stockage que les affiches d'événements.
drop policy if exists "Affiches : déposer" on storage.objects;
create policy "Affiches : déposer" on storage.objects for insert to authenticated
  with check (bucket_id = 'affiches' and ((select private.has_permission('events.manage')) or (select private.has_permission('promos.manage'))));
drop policy if exists "Affiches : retirer" on storage.objects;
create policy "Affiches : retirer" on storage.objects for delete to authenticated
  using (bucket_id = 'affiches' and ((select private.has_permission('events.manage')) or (select private.has_permission('promos.manage'))));

-- Premières bannières (modifiables ou supprimables dans l'administration).
insert into public.promo_slides (eyebrow, title, subtitle, cta_label, cta_href, image_url, theme, effect, position) values
  ('Bienvenue', 'Une famille qui vous accueille', 'Une Parole qui transforme. Venez tel que vous êtes.', 'Nos cultes', '/cultes',
   '/images/heroes/services.webp', 'royal', 'zoom', 1),
  ('Évangélisation', 'Semons la Parole ensemble', 'Vous avez parlé de Jésus-Christ à quelqu''un ? Notez-le et invitez-le au culte.', 'Je participe', '/evangelisation',
   '/images/heroes/messages.webp', 'green', 'slide', 2),
  ('Prière', 'Priez sans cesse', 'Déposez votre sujet : toute l''église prie avec vous.', 'Mon sujet de prière', '/priere',
   '/images/heroes/prayer.webp', 'gold', 'flip', 3),
  ('Dons', 'Donner avec joie', 'Dîmes, offrandes, actions de grâce : par Mobile Money ou au culte.', 'Je donne', '/dons',
   '/images/modules/giving.webp', 'violet', 'mix', 4);
