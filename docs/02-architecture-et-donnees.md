# Architecture technique et modèle de données

## 1. Vue d'ensemble

```
 Smartphone (PWA, hors connexion)        Ordinateur (secrétariat, caisse, pasteur)
              \                                   /
               \______ HTTPS ____________________/
                              |
                 Next.js sur Vercel (App Router)
        ┌──────────────┬──────────────┬───────────────────┐
        │ Modules M1–M23│ Moteur de    │ Tâches planifiées │
        │ (UI + actions)│ capacités    │ (Vercel Cron)     │
        └──────────────┴──────────────┴───────────────────┘
                              |
                         Supabase
     PostgreSQL + RLS · Auth téléphone · Storage · Realtime
                              |
   Services externes : Web Push · WhatsApp (assisté / API) · SMS
                       Jitsi Meet · OpenStreetMap · Google Maps (itinéraire)
                       Agrégateur Mobile Money (ex. CinetPay)
```

## 2. Pile et bibliothèques

| Besoin | Choix |
| --- | --- |
| Framework | Next.js (App Router), TypeScript strict, Server Actions |
| Style | Tailwind CSS, composants maison (voir `03-design.md`) |
| Animations | Framer Motion |
| Données côté client | TanStack Query ; Supabase JS |
| Formulaires | React Hook Form + Zod (schémas partagés client/serveur) |
| Hors connexion | Service Worker (Serwist) + IndexedDB (Dexie), file de synchronisation |
| Base | Supabase PostgreSQL, migrations dans `supabase/migrations/` |
| Auth | Supabase Auth, téléphone + OTP ; mot de passe pour l'administrateur |
| Fichiers | Supabase Storage (photos, justificatifs, reçus, audios) |
| Tâches planifiées | Vercel Cron → routes API protégées par secret |
| Push | Web Push (VAPID) |
| Cartes | Leaflet + tuiles OpenStreetMap ; lien d'itinéraire Google Maps |
| Visio | Jitsi Meet External API (iframe) ou lien externe |
| QR code | Génération côté serveur, scan via la caméra du navigateur |
| PDF / Excel | Génération côté serveur (reçus, rapports) |
| Tests | Vitest (logique et RLS), Playwright (parcours) |

## 3. Arborescence proposée

```
app/
  (auth)/connexion
  (app)/accueil              tableau de bord selon le rôle
  (app)/fideles/[id]
  (app)/familles/[id]
  (app)/groupes/[id]         équipes, cellules, jeunesse, classes
  (app)/cultes/programme
  (app)/caisse
  (app)/cotisations
  (app)/engagements
  (app)/messages
  (app)/reunions
  (app)/pasteur
  (app)/mon-espace           espace fidèle
  (app)/administration       groupes, rôles, paramètres, modules
  p/position/[token]         page publique de capture de position
  api/cron/alertes
  api/cron/envois
lib/
  capabilities/              une capacité = un dossier (ui, actions, schéma)
  permissions/               lecture des affectations rôle/périmètre
  alerts/                    calcul des niveaux d'absence
  messaging/                 canaux push, whatsapp-assiste, whatsapp-api, sms
supabase/
  migrations/
  seed.sql
```

## 4. Modèle de données

Toutes les tables : `id uuid` (généré côté client possible pour le hors-ligne), `created_at`, `updated_at`, `deleted_at` (suppression logique), `created_by`.

### 4.1 Socle configurable
| Table | Colonnes clés | Notes |
| --- | --- | --- |
| `group_types` | `name`, `slug`, `icon`, `default_capabilities jsonb`, `single_membership bool` | Famille = `single_membership` vrai |
| `groups` | `type_id`, `name`, `color`, `parent_id`, `settings jsonb`, `active` | Familles, équipes, cellules, jeunesse, classes |
| `group_functions` | `type_id`, `label`, `rank`, `permissions jsonb` | Responsable, adjoint, secrétaire… |
| `group_memberships` | `group_id`, `person_id`, `function_id`, `start_date`, `end_date` | Historique conservé |
| `capabilities` | `code`, `label`, `version` | agenda, attendance, contributions… |
| `group_capabilities` | `group_id`, `capability_code`, `settings jsonb` | Seuils propres, etc. |
| `roles` | `code`, `label`, `permissions jsonb`, `system bool` | Rôles créables par l'admin |
| `role_assignments` | `person_id`, `role_id`, `scope_type`, `scope_id`, `start_date`, `end_date` | `scope_type` : church, group, subgroup, souls |
| `custom_fields` | `target`, `label`, `type`, `options jsonb`, `required` | |
| `custom_field_values` | `field_id`, `record_id`, `value jsonb` | |
| `value_lists` | `list_code`, `value`, `label`, `position`, `active` | Statuts, motifs, catégories |
| `message_templates` | `event_code`, `channel`, `body` | Variables `{prénom}`… |
| `settings` | `key`, `value jsonb` | Seuils, plafonds, options |
| `modules` | `code`, `enabled` | |

### 4.2 Personnes et suivi
| Table | Colonnes clés |
| --- | --- |
| `people` | noms, sexe, naissance, téléphones, commune, quartier, repère, `home_lat`, `home_lng`, `home_set_by`, `home_set_at`, statut, `arrived_at`, `brought_by` (people), `weekday_exempt bool`, consentements |
| `users` | lien 1-1 `auth.users` ↔ `people`, `last_seen_at` |
| `delegations` | `delegate_id`, `family_id`, `start_date`, `end_date` ; `delegation_members` (N-N) |
| `soul_assignments` | `person_id`, `assignee_id` (membre évangélisation) |
| `sessions` | `type`, `starts_at`, `group_id`, `service_id` |
| `attendance` | `session_id`, `person_id`, `mode` (list, qr, manual), `recorded_by` |
| `excused_absences` | `person_id`, `from`, `to`, `reason` |
| `alerts` | `person_id`, `level`, `days_absent`, `triggered_at`, `status` |
| `follow_ups` | `person_id`, `author_id`, `channel`, `result`, `note`, `confidential`, `next_action_at` |
| `integration_steps` / `person_steps` | étapes paramétrables et leur validation |
| `life_events` | `person_id`, `type`, `date`, `status`, `reported_by` |
| `location_tokens` | `person_id`, `token`, `expires_at`, `used_at` |

### 4.3 Cultes, cellules, pastoral
| Table | Colonnes clés |
| --- | --- |
| `service_types` | `name`, `weekday`, `start_time`, `end_time`, `recurring`, `positions jsonb` |
| `services` | `type_id`, `date`, `theme`, `exceptional` |
| `service_positions` | `service_id`, `position`, `person_id`, `bible_text` |
| `speaker_pools` | `person_id`, `position`, `weekdays` |
| `unavailabilities` | `person_id`, `from`, `to` |
| `swap_requests` | `position_id`, `requester_id`, `replacement_id`, `status` |
| `cell_reports` | `group_id`, `date`, `theme`, `present_count`, `newcomers`, `needs` |
| `prayer_requests` | `author_id`, `text`, `confidential`, `status` |
| `pastoral_slots` / `appointments` | créneaux et rendez-vous |
| `care_files` | `person_id`, `notes_encrypted`, accès pasteur seul |
| `meetings` / `meeting_invitees` / `meeting_tasks` | réunions, réponses, décisions et tâches |

### 4.4 Finances
| Table | Colonnes clés |
| --- | --- |
| `contribution_headings` | `title`, `type`, `scope_type`, `scope_id`, `amount`, `min_amount`, `due_date`, `recurrence`, `target`, `beneficiary_id` |
| `payments` | `heading_id`, `person_id`, `amount`, `method`, `reference`, `status`, `receipt_no` |
| `campaigns` | `title`, `target`, `start_date`, `end_date` |
| `pledges` | `campaign_id`, `person_id` (null si anonyme), `amount`, `due_date`, `schedule jsonb`, `status` |
| `pledge_payments` | `pledge_id`, `amount`, `date`, `method`, `cash_operation_id` |
| `cash_accounts` | `name`, `type` (cash, bank, mobile_money) |
| `cash_operations` | `account_id`, `direction`, `amount`, `category`, `attachment`, `entered_by`, `approved_by`, `status`, `reverses_id` |
| `offering_counts` | `service_id`, `denominations jsonb`, `counter_1`, `counter_2`, `total` |
| `tithes` | `person_id` (null si anonyme), `service_id`, `amount` |
| `budgets` | `year`, `category`, `amount` |
| `period_closings` | `month`, `closed_by`, `closed_at` |

### 4.5 Communication et audit
| Table | Colonnes clés |
| --- | --- |
| `broadcasts` | `author_id`, `audience jsonb`, `body`, `channel`, `scheduled_at`, `sent_at` |
| `broadcast_recipients` | `broadcast_id`, `person_id`, `status`, `read_at` |
| `push_subscriptions` | `user_id`, `endpoint`, `keys` |
| `audit_log` | `actor_id`, `action`, `table_name`, `record_id`, `before`, `after`, `at` (insertion seule) |

## 5. Sécurité

- **RLS sur toutes les tables.** Fonctions SQL `security definer` : `has_role(code, scope_type, scope_id)`, `can_see_person(person_id)`, `can_manage_person(person_id)`, qui lisent `role_assignments`, `group_memberships`, `delegations`, `people.brought_by`, `soul_assignments`.
- `can_see_person` est vrai si l'utilisateur est la personne elle-même, pasteur ou assistant, père de famille de sa famille, délégué de son sous-groupe, responsable évangélisation, gagneur d'âme de cette personne, membre évangélisation assigné, ou responsable d'un groupe dont elle est membre (champs limités).
- Colonnes `home_lat/home_lng` exposées via une vue restreinte (famille, délégué, pasteur, assistants).
- `care_files` : chiffrement applicatif (clé côté serveur), accès pasteur uniquement.
- Finances : pas de `DELETE` autorisé ; contre-opérations ; `period_closings` bloque les écritures sur un mois clos (trigger).
- `audit_log` alimenté par triggers, aucune mise à jour ni suppression permise.
- Tests Vitest dédiés : chaque rôle tente de lire et écrire hors de son périmètre et doit échouer.

## 6. Logique clé

### 6.1 Calcul des alertes (cron quotidien, 6 h, heure d'Abidjan = UTC)
Pour chaque personne active non excusée : date de dernière présence comptable (dimanche seul si `weekday_exempt`, sinon tout culte) → jours d'absence → niveau selon `settings.alert_thresholds`. Si le niveau change : mise à jour de `alerts`, notifications aux destinataires du niveau, une seule fois par changement.

### 6.2 Génération du programme de modération
Entrées : période (2, 3, 6 mois), cultes de la période, viviers, indisponibilités. Algorithme de roulement équitable (le moins sollicité d'abord, pas deux postes le même jour), puis édition manuelle et publication.

### 6.3 Hors connexion
Les actions pointage, note de suivi et position sont mises en file dans IndexedDB avec un UUID client, rejouées à la reconnexion, idempotentes côté serveur.
