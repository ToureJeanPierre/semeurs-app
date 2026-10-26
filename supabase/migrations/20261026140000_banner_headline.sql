-- Titre affiché au-dessus du verset du jour sur la bannière
-- (demande de Jean-Pierre du 26/10/2026, message d'accueil de l'affiche).

update public.settings
set value = value || jsonb_build_object('headline', 'Jésus-Christ t’aime')
where key = 'home_banner' and not (value ? 'headline');
