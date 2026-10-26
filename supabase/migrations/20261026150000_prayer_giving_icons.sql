-- Icônes corrigées par Jean-Pierre (26/10/2026) : mains jointes pour la prière,
-- main au cœur pour les dons.
update public.modules set icon = 'hands-praying' where code = 'prayer';
update public.modules set icon = 'hand-heart' where code = 'giving';
