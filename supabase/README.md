# Base de données

Chaque changement de schéma est un fichier SQL daté dans `migrations/`, appliqué dans l'ordre.

Claude Code applique les migrations lui-même via l'API de gestion Supabase
(`SUPABASE_ACCESS_TOKEN`), et les enregistre dans `supabase_migrations.schema_migrations`
avec la même version que le nom du fichier.

| Migration | Contenu |
| --- | --- |
| `20261025000000_webauthn_credentials.sql` | Clés d'accès (empreinte / schéma), RLS : chacun ne voit que les siennes |
| `20261026000000_home_configuration.sql` | Paramètres, types de culte, versets du jour, modules (raccourcis de l'accueil) ; lecture pour les personnes connectées, écriture réservée au serveur jusqu'au lot 1 |
| `20261026120000_modules_navigation.sql` | `modules.nav_position` (barre du bas configurable), raccourcis réordonnés selon la maquette, module Événements |
| `20261026130000_home_banner.sql` | Paramètre `home_banner` (adresse de la photo de la bannière ; vide = dessin de secours) |
