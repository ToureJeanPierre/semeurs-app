-- Motifs de suppression d'une fiche : liste administrable (Administration → Listes), « Autre » pour écrire.
insert into public.value_lists (list_code, value, label, position) values
  ('archive_reason', 'duplicate', 'Doublon (fiche enregistrée deux fois)', 1),
  ('archive_reason', 'typo', 'Erreur de saisie', 2),
  ('archive_reason', 'left', 'A quitté l''église', 3),
  ('archive_reason', 'moved', 'A déménagé loin', 4),
  ('archive_reason', 'deceased', 'Décédé(e)', 5)
on conflict (list_code, value) do nothing;
