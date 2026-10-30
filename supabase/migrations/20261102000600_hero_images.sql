-- Illustrations de bandeau fournies par Jean-Pierre (30/10/2026), distinctes des vignettes du menu.
alter table public.modules add column if not exists hero_image text
  check (hero_image is null or hero_image ~ '^(/|https://)');

update public.modules m set hero_image = v.url
from (values
  ('trainings', '/images/heroes/trainings.webp'),
  ('prayer', '/images/heroes/prayer.webp')
) as v(code, url)
where m.code = v.code;
