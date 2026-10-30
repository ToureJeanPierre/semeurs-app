-- Événements de vie : autre accroche et autre verset (demande de Jean-Pierre du 30/10/2026).
update public.modules
set hero_title = 'Dieu est présent à chaque saison',
    verse_text = 'Il y a un temps pour tout, un temps pour toute chose sous les cieux.',
    verse_ref = 'Ecclésiaste 3:1'
where code = 'life_events';
