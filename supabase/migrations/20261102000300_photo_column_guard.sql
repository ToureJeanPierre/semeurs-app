-- La photo ne change que par set_person_photo (contrôle du dossier et ménage de l'ancienne).
revoke insert (photo_path), update (photo_path) on public.people from authenticated;
