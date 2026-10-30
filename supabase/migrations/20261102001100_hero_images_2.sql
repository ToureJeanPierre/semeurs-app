-- Bannières de Jean-Pierre (30/10/2026, 2ᵉ série) : cultes, événements, annonces.
update public.modules m set hero_image = v.url
from (values
  ('services', '/images/heroes/services.webp'),
  ('events', '/images/heroes/events.webp'),
  ('messages', '/images/heroes/messages.webp')
) as v(code, url)
where m.code = v.code;

update public.modules set hero_title = 'Tous les événements de la communauté' where code = 'events';
