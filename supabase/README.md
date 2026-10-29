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
| `20261026140000_banner_headline.sql` | Titre « Jésus-Christ t’aime » au-dessus du verset du jour (`home_banner.headline`) |
| `20261026150000_prayer_giving_icons.sql` | Icônes : mains jointes pour Prières, main au cœur pour Dons |
| `20261027000000_core_engine.sql` | Lot 1 — socle : personnes, comptes, groupes et types, bureau (fonctions), appartenances (une seule famille), capacités, droits / rôles / affectations, listes de valeurs, journal d'audit ; fonctions `private.has_permission`, `can_see_person`… ; RLS ; données de l'église (docs/05) |
| `20261027010000_admin_module.sql` | `modules.required_permissions` et module « Administration » (visible selon les droits) |
| `20261027100000_people_families.sql` | Lot 1 étape 2 — fiche complétée, délégation (`delegations`, `delegation_members`), `add_person_to_group`, `can_manage_person`, `my_groups`, `my_access` avec droits de groupe, `modules.required_scope`, modules Fidèles / Ma famille / Mes groupes |
| `20261028000000_attendance.sql` | Cultes (`sessions`), présences, absences excusées, jetons QR, rôle Protocole, `attendance_roster`, `record_attendance_by_qr` |
| `20261028010000_alerts.sql` | Alertes d'absence, `compute_alerts` (serveur seulement), journal de suivi, notifications, listes de valeurs du suivi |
| `20261028020000_follow_helpers.sql` | `public.can_follow_person` (qui peut noter un contact) |
| `20261028030000_member_space.sql` | Domiciles (GPS, lien à usage unique), modèles de message, anniversaires, messages groupés, audiences et créneaux |
| `20261028040000_sendable_groups.sql` | `my_message_targets` : groupes auxquels on peut écrire |
| `20261028050000_demo_data_flag.sql` | Colonne `is_demo` (personnes, groupes, cultes) : la démonstration ne se mêle pas aux vraies données |
| `20261029000000_absence_message.sql` | Message de prise de nouvelles choisi par Jean-Pierre (pré-rempli dans SMS et WhatsApp) |
| `20261029100000_service_program.sql` | Lot 2 — programme des cultes : `services`, `service_positions`, viviers, indisponibilités, échanges, `program_view`, `publish_program`, rappels J-3/J-1 |
| `20261029100100_program_helpers.sql` | `notify_position_change`, `swap_candidates` |
| `20261029200000_contributions.sql` | Cotisations : rubriques, versements, reçus numérotés, garde-fous (pas de suppression, contre-opération), `contribution_status`, `remind_contribution` |
| `20261029200100_groups_with_right.sql` | `my_groups_with(droit)` : groupes où l'on détient un droit |
| `20261029200200_receipt_notification.sql` | Notification « reçu prêt » ou « déclaration refusée » |
| `20261029200300_status_first_name.sql` | Suivi des cotisations avec le prénom (relances personnalisées) |
| `20261029300000_meetings_life_events.sql` | Réunions (Jitsi, invités, réponses, compte rendu, tâches, rappels) et événements de vie |
| `20261029300100_life_event_heading_link.sql` | Lien événement de vie → cotisation de soutien porté par la cotisation |
| `20261029400000_souls.sql` | Âmes : parcours d'intégration, assignations, sorties d'évangélisation, `register_soul`, `souls_overview` ; périmètre élargi au gagneur et à l'assigné |
| `20261029500000_group_capabilities.sql` | Capacités des groupes : agenda, présences de groupe, planning de service, chaîne de prière, répertoire, rapports, mur de prière, alerte sans rapport |
| `20261029500100_prayer_confidentiality.sql` | Prières confidentielles : l'administrateur ne les voit pas |
| `20261030000000_meeting_room_no_login.sql` | Salle en ligne sur un serveur Jitsi public sans compte |
| `20261030010000_cancel_service.sql` | Retirer un culte du programme, même publié (personnes prévenues) |
| `20261030020000_simple_member_menu.sql` | Menu du simple fidèle raccourci, `my_family`, familles visibles entre membres |
| `20261030030000_family_fraternity.sql` | Fraternité : numéro masquable, bienvenue aux nouveaux, anniversaires |
| `20261030040000_group_chat.sql` | Discussion de groupe en temps réel, non-lus |
| `20261030040100_group_chat_privacy.sql` | Discussion réservée aux membres du groupe |
| `20261031000000_cash.sql` | Caisse : comptes, opérations à quatre yeux, comptages, engagements, arrêtés, budget |
| `20261031000100_cash_guard_fix.sql` | Correctif du garde-fou de caisse (confirmation de comptage) |
| `20261031000200_anonymous_tithe.sql` | Dîme anonyme |
| `20261031000300_giving_instructions.sql` | Consignes de don (numéro Mobile Money) en paramètre |
| `20261031100000_pastoral_youth.sql` | Cure d'âme chiffrée, Jeunesse par l'âge, inscriptions, idées, tableau de bord |
| `20261031100100_readable_settings.sql` | Paramètres lisibles par tous les connectés |
| `20261031200000_web_push.sql` | Notifications push sur le téléphone |
| `20261101000000_lot4_modules.sql` | Prédications, événements, formations, actes, liens, inventaire, sondages |
| `20261101000100_children_capability.sql` | Capacité « Enfants confiés » (école du dimanche) |
| `20261101000200_module_images.sql` | Illustration de chaque module (cartes du menu) |
| `20261101000300_more_module_images.sql` | Illustrations : actes, sondages, administration, annonces, prédications |
| `20261101000400_module_images_3.sql` | Illustrations : prières, cultes, événements |
| `20261101000500_module_images_4.sql` | Illustrations : caisse, mes groupes, inventaire, formations |

Tests des règles RLS : `npm run test:rls` (nécessite `SUPABASE_ACCESS_TOKEN`). Chaque scénario
s'exécute dans un bloc qui se termine par une exception : rien ne reste en base.
