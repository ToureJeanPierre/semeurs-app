-- Bandeau illustré en tête de chaque onglet (maquette de Jean-Pierre du 29/10/2026) :
-- phrase d'accroche et verset (Louis Segond), modifiables par module.
alter table public.modules add column if not exists hero_title text;
alter table public.modules add column if not exists verse_text text;
alter table public.modules add column if not exists verse_ref text;

update public.modules m set hero_title = v.t, verse_text = v.v, verse_ref = v.r
from (values
  ('events', 'Ensemble dans la présence de Dieu', 'Car là où deux ou trois sont assemblés en mon nom, je suis au milieu d''eux.', 'Matthieu 18:20'),
  ('sermons', 'La Parole qui nourrit', 'L''homme ne vivra pas de pain seulement, mais de toute parole qui sort de la bouche de Dieu.', 'Matthieu 4:4'),
  ('services', 'Venez, adorons !', 'Je suis dans la joie quand on me dit : Allons à la maison de l''Éternel !', 'Psaume 122:1'),
  ('prayer', 'Priez sans cesse', 'Ne vous inquiétez de rien ; mais en toute chose faites connaître vos besoins à Dieu par des prières et des supplications.', 'Philippiens 4:6'),
  ('messages', 'Les nouvelles de l''église', null, null),
  ('giving', 'Donner avec joie', 'Dieu aime celui qui donne avec joie.', '2 Corinthiens 9:7'),
  ('contributions', 'Porter ensemble', 'Portez les fardeaux les uns des autres.', 'Galates 6:2'),
  ('family', 'Une famille dans la foi', 'Voici, oh ! qu''il est agréable, qu''il est doux pour des frères de demeurer ensemble !', 'Psaume 133:1'),
  ('my_groups', 'Servir ensemble', 'Que chacun de vous mette au service des autres le don qu''il a reçu.', '1 Pierre 4:10'),
  ('my_space', 'Mon chemin avec Dieu', 'Ta parole est une lampe à mes pieds, et une lumière sur mon sentier.', 'Psaume 119:105'),
  ('souls', 'Accueillir et accompagner', 'Le semeur sème la parole.', 'Marc 4:14'),
  ('evangelism', 'Semer la Parole', 'Allez, faites de toutes les nations des disciples.', 'Matthieu 28:19'),
  ('people', 'Chaque brebis compte', 'Je connais mes brebis, et elles me connaissent.', 'Jean 10:14'),
  ('alerts', 'Aller vers celui qui manque', null, null),
  ('attendance', 'Présents au rendez-vous', 'N''abandonnons pas notre assemblée.', 'Hébreux 10:25'),
  ('meetings', 'Se réunir pour avancer', null, null),
  ('audiences', 'Un temps d''écoute', null, null),
  ('life_events', 'Se réjouir et pleurer ensemble', 'Réjouissez-vous avec ceux qui se réjouissent ; pleurez avec ceux qui pleurent.', 'Romains 12:15'),
  ('trainings', 'Grandir dans la foi', 'Croissez dans la grâce et dans la connaissance de notre Seigneur et Sauveur Jésus-Christ.', '2 Pierre 3:18'),
  ('cash', 'Fidèles dans la gestion', 'Ce qu''on demande des dispensateurs, c''est que chacun soit trouvé fidèle.', '1 Corinthiens 4:2'),
  ('acts', 'La mémoire de l''église', null, null),
  ('inventory', 'Prendre soin de nos biens', null, null),
  ('polls', 'Votre avis compte', null, null),
  ('dashboard', 'Vue d''ensemble', null, null),
  ('admin', 'Tout se règle ici', null, null)
) as v(code, t, v, r)
where m.code = v.code;
