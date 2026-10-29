-- Illustrations envoyées par Jean-Pierre le 29/10/2026 (2ᵉ série).
update public.modules m set image_url = v.url
from (values
  ('acts', '/images/modules/acts.webp'),
  ('polls', '/images/modules/polls.webp'),
  ('admin', '/images/modules/admin.webp'),
  ('messages', '/images/modules/messages.webp'),
  ('sermons', '/images/modules/sermons.webp')
) as v(code, url)
where m.code = v.code;
