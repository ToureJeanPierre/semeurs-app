-- Illustrations envoyées par Jean-Pierre le 29/10/2026 (4ᵉ série).
update public.modules m set image_url = v.url
from (values
  ('cash', '/images/modules/cash.webp'),
  ('my_groups', '/images/modules/my-groups.webp'),
  ('inventory', '/images/modules/inventory.webp'),
  ('trainings', '/images/modules/trainings.webp')
) as v(code, url)
where m.code = v.code;
