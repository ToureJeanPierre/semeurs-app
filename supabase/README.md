# Base de données

Chaque changement de schéma est un fichier SQL daté dans `migrations/`, appliqué dans l'ordre.

En attendant l'application automatique (prévue au lot 1), une migration s'applique ainsi :
Supabase → **SQL Editor** → **New query** → coller le contenu du fichier → **Run**.

| Migration | Contenu |
| --- | --- |
| `20261025000000_webauthn_credentials.sql` | Clés d'accès (empreinte / schéma), RLS : chacun ne voit que les siennes |
