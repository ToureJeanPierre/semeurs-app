-- Dons : comment donner (numéros Mobile Money de l'église…), affiché au fidèle ; modifiable
-- dans Administration → Paramètres.
insert into public.settings (key, value, label, is_public) values
  ('giving_instructions', '""', 'Comment donner (numéros Mobile Money de l''église, Wave…)', false)
on conflict (key) do nothing;
