-- Navigation configurable : les modules peuvent figurer dans la barre du bas
-- (nav_position) en plus de l'accueil (home_position). Accueil et Profil
-- restent toujours présents aux deux extrémités de la barre.
--
-- Raccourcis réorganisés selon la maquette validée par Jean-Pierre le 26/10/2026 :
-- Prédications, Cultes, Annonces / Prières, Événements, Dons.

alter table public.modules add column nav_position integer;

comment on column public.modules.nav_position is
  'Ordre dans la barre du bas (entre Accueil et Profil) ; null = absent de la barre.';

update public.modules set label = 'Annonces', home_position = 3 where code = 'messages';
update public.modules set label = 'Prières', home_position = 4 where code = 'prayer';
update public.modules set label = 'Dons', icon = 'heart', home_position = 6 where code = 'giving';
update public.modules set icon = 'circle-play', home_position = 2 where code = 'services';
update public.modules set home_position = 1, nav_position = 1 where code = 'sermons';
-- « Ma famille » reste accessible par le menu ; il revient sur l'accueil
-- du père de famille au lot 1 (accueil selon le rôle).
update public.modules set home_position = null where code = 'family';

insert into public.modules (code, label, description, icon, href, enabled, home_position, nav_position) values
  ('events', 'Événements', 'Agenda de l''église : cultes, réunions, programmes spéciaux', 'calendar-days', '/evenements', false, 5, 2)
on conflict (code) do nothing;
