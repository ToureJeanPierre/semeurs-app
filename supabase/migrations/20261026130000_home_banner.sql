-- Bannière de l'accueil : une photo, sur laquelle s'affiche le verset du jour
-- (demande de Jean-Pierre du 26/10/2026). L'adresse de la photo est un
-- paramètre ; tant qu'elle est vide, l'application affiche un dessin de secours.

insert into public.settings (key, label, is_public, value) values
  ('home_banner', 'Bannière de l''accueil', true, jsonb_build_object('image_url', null))
on conflict (key) do nothing;
