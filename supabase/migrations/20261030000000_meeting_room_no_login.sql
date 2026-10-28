-- Réunions en ligne : meet.jit.si demande désormais à l'organisateur de se connecter
-- (compte Google…) et propose d'installer une appli. On passe sur un serveur Jitsi public
-- et gratuit qui s'ouvre directement dans le navigateur, sans compte (modifiable ici).
update public.settings set value = '"https://meet.ffmuc.net/"'
where key = 'meeting_online_base_url' and value = '"https://meet.jit.si/"';

update public.meetings set online_url = replace(online_url, 'https://meet.jit.si/', 'https://meet.ffmuc.net/')
where status = 'planned' and online_url like 'https://meet.jit.si/%';
