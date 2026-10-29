-- Illustrations envoyées par Jean-Pierre le 29/10/2026 (3ᵉ série).
update public.modules m set image_url = v.url
from (values
  ('prayer', '/images/modules/prayer.webp'),
  ('services', '/images/modules/services.webp'),
  ('events', '/images/modules/events.webp')
) as v(code, url)
where m.code = v.code;
