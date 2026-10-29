-- Illustrations envoyées par Jean-Pierre le 29/10/2026 (5ᵉ série) : pointage, nouvelle image des événements de vie.
update public.modules m set image_url = v.url
from (values
  ('attendance', '/images/modules/attendance.webp'),
  ('life_events', '/images/modules/life-events-2.webp')
) as v(code, url)
where m.code = v.code;
