-- Illustration de chaque module (cartes du menu, maquette de Jean-Pierre du 29/10/2026).
-- Facultative : sans image, la carte affiche l'icône du module.
alter table public.modules add column if not exists image_url text
  check (image_url is null or image_url ~ '^(/|https://)');

update public.modules m set image_url = v.url
from (values
  ('meetings', '/images/modules/meetings.webp'),
  ('people', '/images/modules/people.webp'),
  ('life_events', '/images/modules/life-events.webp'),
  ('souls', '/images/modules/souls.webp'),
  ('audiences', '/images/modules/audiences.webp'),
  ('giving', '/images/modules/giving.webp'),
  ('family', '/images/modules/family.webp'),
  ('my_space', '/images/modules/my-space.webp'),
  ('contributions', '/images/modules/contributions.webp')
) as v(code, url)
where m.code = v.code;
