# Spécification fonctionnelle — évolutions de novembre 2026

Demande de Jean-Pierre du 09/11/2026. Ce document décrit, module par module, **ce qui change** par
rapport à l'application en ligne (lots 0 à 4 et retours d'octobre-novembre), la **structure de données**
à ajouter ou modifier, les **droits** (RLS) et l'**architecture fonctionnelle** (écrans, actions,
tâches planifiées). Principe inchangé : tout se configure, rien ne se recode (CLAUDE.md §3).

Légende : **Existe** = déjà livré et réutilisé tel quel · **Évolue** = livré, à modifier ·
**Nouveau** = à construire.

---

## 0. Vue d'ensemble

| Module | Existe | Évolue | Nouveau |
| --- | --- | --- | --- |
| 1. Audiences | Créneaux (`settings.audience_schedule`), réservation, `appointments` | Réservation bloquée les jours indisponibles | `pastor_unavailability`, `appointment_notices`, alerte groupée |
| 2. Programme de l'église | `services`, `service_positions`, publication | Onglet renommé, rôles masqués aux fidèles, fenêtre glissante | Réglage `program_window_days` |
| 3. Dons, dîmes, offrandes | Caisse 4 yeux, `cash_operations`, déclarations, campagnes | Dîme vers le pasteur, offrande à distance, don libre motivé | Réglage `giving_channels`, champ `purpose` |
| 4. Famille | Chat, réunions en ligne, messages du père, cotisations, événements de vie | Annonces combinées église + famille | Cotisations de service (listes), tenues |
| 5. Équipes | Capacités, planning de service, agenda, multi-appartenance | Répétitions typées | Caisse d'équipe, tenues (commun avec Famille) |
| 6. Mon espace | Absence, code QR, cotisations, nouvelles | Absence déplacée en fin de parcours | — |

Aucune donnée existante n'est perdue : toutes les évolutions sont des ajouts de colonnes, de tables
et de réglages (migrations versionnées dans `supabase/migrations/`).

---

## 1. Module Audiences (rendez-vous avec le pasteur)

### 1.1 Besoin
- Un interrupteur **« Indisponible »** bloque instantanément la prise de rendez-vous sur un jour.
- Si une permanence (ex. le mercredi) est annulée ou reportée, une **alerte groupée** prévient les
  fidèles déjà inscrits, par **SMS, WhatsApp ou appel**.

### 1.2 Données

**Nouveau — `pastor_unavailability`** (jours où le pasteur ne reçoit pas)

| Colonne | Type | Règle |
| --- | --- | --- |
| `id` | uuid PK | |
| `day` | date, unique | Le jour bloqué |
| `reason` | text | Facultatif, visible des fidèles (« Voyage », « Convention »…) |
| `rescheduled_to` | date | Facultatif : jour de report proposé |
| `created_by` | uuid → people | Pasteur ou secrétariat |
| `created_at` | timestamptz | |

**Évolue — `appointments`** : `status` accepte en plus `cancelled_by_pastor` et `moved`
(en plus de `confirmed`, `cancelled`) ; nouvelle colonne `moved_to timestamptz`.

**Nouveau — `appointment_notices`** (journal des prévenances, une ligne par fidèle prévenu)

| Colonne | Type | Règle |
| --- | --- | --- |
| `id` | uuid PK | |
| `appointment_id` | uuid → appointments | |
| `channel` | text | `app` (notification + push), `whatsapp`, `sms`, `call` |
| `sent_by` | uuid → people | Qui a prévenu |
| `sent_at` | timestamptz | |
| `outcome` | text | Facultatif : `reached`, `no_answer` (pour l'appel) |

**Réglage — `message_templates.audience_cancelled`** : « Bonjour {prénom}, la permanence du
pasteur du {date} est {annulée / reportée au …}. Que Dieu vous bénisse. » (modifiable).

### 1.3 Droits (RLS)
- Lire `pastor_unavailability` : toute personne connectée (pour griser les jours).
- Écrire : droit `audiences.manage` (pasteur, secrétariat).
- `appointment_notices` : lecture et écriture `audiences.manage` ; un fidèle ne voit rien.
- Fonction `book_appointment` (existante) : refuse tout créneau dont le jour figure dans
  `pastor_unavailability` (message clair, code `P0001`).

### 1.4 Parcours
1. **Pasteur / secrétariat** — écran Audiences → calendrier des permanences. Sur chaque jour, un
   interrupteur **Disponible / Indisponible**.
2. Passer à **Indisponible** :
   - le jour est grisé immédiatement pour les fidèles (réservation impossible) ;
   - s'il y a déjà des rendez-vous ce jour-là, une fenêtre s'ouvre : motif (facultatif), report
     (facultatif : nouveau jour), puis **« Prévenir les N fidèles inscrits »**.
3. **Alerte groupée** — trois niveaux, du gratuit au payant :
   - **Toujours** : notification dans l'appli + notification sur le téléphone (Web Push), gratuites.
   - **Assisté (gratuit)** : liste des fidèles concernés avec, pour chacun, les boutons
     **WhatsApp** et **SMS** (message déjà écrit) et **Appeler** ; chaque envoi est coché et
     journalisé dans `appointment_notices`.
   - **Automatique (payant, désactivé par défaut)** : si `settings.paid_channels.sms` ou
     `whatsapp_api` est activé, un seul bouton envoie à tous (passerelle SMS / API WhatsApp
     Business, déjà prévue dans le code, voir `docs/01` §15).
4. Le rendez-vous passe à `cancelled_by_pastor` ou `moved` ; le fidèle le voit dans Mon espace.

### 1.5 Fonctions
- `set_pastor_unavailable(p_day date, p_reason text, p_move_to date)` → renvoie les rendez-vous touchés.
- `set_pastor_available(p_day date)` → supprime le blocage (les rendez-vous annulés le restent).
- `notify_appointment_change(p_appointment uuid, p_channel text)` → écrit la notification
  et le journal.

---

## 2. Module Programme de l'église

### 2.1 Besoin
- L'onglet **« Cultes »** devient **« Programme de l'église »**.
- Les fidèles ne voient **plus** le prédicateur ni le modérateur : seulement les activités.
- Affichage **glissant** de 1 à 2 semaines, 1 mois au plus.

### 2.2 Données
- **Évolue — `modules`** (ligne `services`) : `label = 'Programme de l'église'`, bandeau mis à jour.
  Aucun nom écrit dans le code : le titre vient de la table.
- **Nouveau réglage — `settings.program_window_days`** : entier entre 7 et 31, **14 par défaut**
  (choisi par l'administration, curseur « 1 semaine · 2 semaines · 1 mois »).
- **Nouveau réglage — `settings.program_public_positions`** : liste des postes affichés aux fidèles,
  **vide par défaut** (donc aucun nom). L'administration pourra y remettre un poste si l'église
  le souhaite un jour, sans développement.
- `services` et `service_positions` : inchangés.

### 2.3 Affichage selon le profil

| Qui | Ce qu'il voit |
| --- | --- |
| Fidèle | Activités de la fenêtre glissante : date, heure, intitulé, lieu, thème général s'il est public. **Aucun nom.** |
| Personne programmée | En plus, **ses propres** passages dans Mon espace (« Vous êtes modérateur le 16/11 »), échanges possibles comme aujourd'hui |
| Responsable du programme (`program.manage`) | Écran de préparation complet, avec tous les postes et noms |

La règle est appliquée **dans la base** : la fonction `program_view` ne renvoie les noms que si
l'appelant a `program.manage` ou si le poste est le sien, ou s'il figure dans
`program_public_positions`. Un fidèle ne peut donc pas les lire, même en appelant l'API.

### 2.4 Fenêtre glissante
`program_view(today, today + program_window_days)` : la fenêtre avance seule chaque jour, sans
intervention. L'accueil (« Prochain culte ») et la bande des annonces suivent le même réglage.

---

## 3. Module Dons, dîmes et offrandes

### 3.1 Besoin
- **Dîme** : versée **directement au pasteur**, numéro **07 07 62 46 31**.
- **Offrande** : numéro récepteur **au choix du pasteur** (caissier ou pasteur) ; offrande **à
  distance** possible.
- **Don libéral** : toujours disponible, sans campagne, avec un **motif** écrit (terrain, chaises,
  piano…).

### 3.2 Données

**Nouveau réglage — `settings.giving_channels`** (remplace le texte libre `giving_instructions`)

```json
{
  "tithe":    { "receiver": "pastor",  "label": "Pasteur",  "phone": "+2250707624631", "networks": ["orange_money", "mtn_momo", "moov_money", "wave"] },
  "offering": { "receiver": "cashier", "label": "Caisse",   "phone": null,             "networks": ["orange_money", "wave"] },
  "gift":     { "receiver": "cashier", "label": "Caisse",   "phone": null,             "networks": ["orange_money", "wave"] }
}
```

- Le numéro de dîme **07 07 62 46 31** est la valeur initiale, **modifiable par le pasteur** dans
  Administration → Paramètres → Dons (règle « rien en dur »).
- `receiver` : `pastor` ou `cashier` ; pour `offering`, le pasteur choisit lui-même.

**Évolue — `cash_operations`**
- Nouvelle colonne `purpose text` : motif du don libéral (obligatoire si `category = 'gift'`,
  3 à 200 caractères).
- Nouvelle colonne `receiver text` : `pastor` ou `cashier` (copié du réglage au moment du don,
  pour l'historique).
- Catégories (liste `income_category`) : `tithe`, `offering`, `gift`, `thanksgiving`, `pledge`
  (ajout de `offering` si absent).

**Nouvelle liste — `gift_purpose`** (suggestions, l'écriture libre reste possible) : Terrain,
Construction, Chaises, Piano / instruments, Sonorisation, Véhicule, Autre.

### 3.3 Parcours fidèle (onglet Dons)
Trois grandes cartes :

1. **Ma dîme** — « Envoyée directement au pasteur » · numéro affiché · boutons
   **Orange Money / MTN / Moov / Wave** (ouvrent l'application ou le code USSD avec le numéro
   prérempli) · puis **« J'ai envoyé : prévenir »** (montant, référence du SMS).
2. **Mon offrande** — même parcours vers le numéro choisi par le pasteur ; utilisable à tout
   moment (« offrande à distance »).
3. **Un don libéral** — montant, **motif** (liste de suggestions + texte libre), puis le même
   paiement Mobile Money et « prévenir ».

Paiement en ligne **direct dans l'appli** (agrégateur type CinetPay) : prévu, **désactivé par
défaut** car payant (`settings.paid_channels.online_payment`). Sans lui, le paiement se fait dans
l'application Mobile Money du fidèle et la déclaration est vérifiée par le destinataire.

### 3.4 Qui valide
| Catégorie | Reçu par | Vérifié par |
| --- | --- | --- |
| Dîme | Pasteur | **Le pasteur** (`cash.approve`) : il confirme « reçu » sur son téléphone |
| Offrande / don | Pasteur **ou** caissier (réglage) | Le destinataire ; si caissier, validation à deux comme aujourd'hui |

> **Point à trancher (finances, CLAUDE.md §6)** — voir §8, décision D2.

### 3.5 Confidentialité
- Un fidèle ne voit que ses propres dons (déjà le cas).
- Dîmes : visibles du pasteur seul (et, selon D2, de la trésorerie en totaux uniquement).
- Aucun total annuel ni attestation côté fidèle (décision du 30/10, inchangée).

---

## 4. Module Famille (cellules de maison)

### 4.1 Besoin et correspondance

| Exigence | Existant | À faire |
| --- | --- | --- |
| Le père (animateur) diffuse les informations | Messages groupés (`broadcasts`, droit `messages.send` du père) | Rien |
| Visioconférence intégrée (prière, réunions) | Réunions en ligne (`meetings.mode = online`, salle Jitsi gratuite) | Bouton « Réunion de prière maintenant » (réunion instantanée en un geste) |
| Messagerie instantanée | Discussion de famille en temps réel (`group_messages`) | Rien |
| Cotisations de service (cambuse, bureau du pasteur, mois de service) | Cotisations par groupe (`contribution_headings`) | Trois **types** ajoutés à la liste `contribution_kind` |
| Tenues confectionnées | — | **Nouveau** (§4.2, commun avec les équipes) |
| Événements de vie | `life_events` + cotisation liée | Rien |
| Annonces église + famille | Onglet Annonces (église) | **Fil combiné** dans Ma famille (§4.3) |

### 4.2 Tenues (commun Famille et Équipes)

**Nouveau — capacité de groupe `outfits`** (« Tenues »), cochable pour tout groupe.

**Nouveau — `outfits`** (un modèle de tenue)

| Colonne | Type | Règle |
| --- | --- | --- |
| `id` | uuid PK | |
| `group_id` | uuid → groups | |
| `title` | text | « Pagne de la fête des familles 2026 » |
| `description` | text | Tissu, couleur, modèle |
| `photo_path` | text | Photo du tissu ou du modèle (stockage `affiches`) |
| `unit_price` | integer | Prix par personne (FCFA) |
| `order_deadline` | date | Date limite des commandes |
| `delivery_date` | date | Date de livraison prévue |
| `status` | text | `open`, `ordered`, `delivered`, `closed` |

**Nouveau — `outfit_orders`** (une ligne par membre)

| Colonne | Type | Règle |
| --- | --- | --- |
| `outfit_id` | uuid → outfits | |
| `person_id` | uuid → people | |
| `size` | text | Liste `outfit_size` (S, M, L, XL, sur mesure) |
| `measurements` | text | Facultatif (sur mesure) |
| `quantity` | integer ≥ 1 | |
| `paid_amount` | integer | Somme versée (paiement suivi par une **cotisation liée**, voir ci-dessous) |
| `status` | text | `requested`, `sewn`, `delivered` |

Le paiement d'une tenue réutilise les **cotisations** : créer une tenue crée une rubrique de
cotisation liée (`contribution_headings.outfit_id`), avec reçus et validation déjà existants.

### 4.3 Annonces combinées
Dans **Ma famille**, un fil « Annonces » mélange, par date décroissante :
- les annonces **de l'église** (messages à toute l'église, événements à venir) ;
- les annonces **de la famille** (messages du père et de son bureau).

Chaque annonce porte une pastille **Église** (or) ou **Ma famille** (bleu). Source : les
notifications de type `message` (déjà ciblées) + `church_events`. Aucune nouvelle table.

### 4.4 Réunion de prière instantanée
Bouton **« Prier ensemble maintenant »** pour le père et son bureau : crée une `meeting`
`mode = online`, invite toute la famille, envoie la notification avec le lien de la salle.

---

## 5. Module Équipes (départements de service)

### 5.1 Principe
Une équipe est un **groupe** de type « Équipe » : elle bénéficie de tout ce que la famille a déjà
(discussion, annonces, réunions, cotisations, événements), plus des capacités propres au service.
Les capacités se cochent dans Administration → Groupes ; un nouveau département (Groupe musical,
Protocole, Média…) fonctionne immédiatement.

### 5.2 Caisse d'équipe — **Nouveau** (capacité `team_cash`)

**Évolue — `cash_accounts`** : nouvelle colonne `group_id uuid → groups` (nulle = caisse de
l'église). Une équipe qui coche « Caisse » reçoit un compte à son nom.

- Les opérations de l'équipe vont dans `cash_operations` avec ce compte : **même garde-fou**
  (annulation par contre-opération motivée, rien ne s'efface, journal).
- Saisie : trésorier(ère) de l'équipe (fonction avec `cash.manage` **dans le groupe**) ;
  validation : le responsable de l'équipe (règle des quatre yeux à l'échelle du groupe).
- Lecture : bureau de l'équipe + trésorerie de l'église (consolidation dans les bilans).
- Le solde de l'équipe s'affiche dans sa page ; il est **séparé** de la caisse de l'église.

### 5.3 Tenues
Identique à §4.2 (capacité `outfits`).

### 5.4 Répétitions — **Évolue**
- **`group_events`** : nouvelle colonne `kind text` (liste `group_event_kind` : Répétition,
  Réunion, Sortie, Autre). Les répétitions récurrentes existent déjà (`recurrence`, `until`).
- **Présences aux répétitions** : réutilise le pointage de groupe existant (séances de groupe).
- Rappel la veille aux membres (tâche quotidienne existante, étendue aux répétitions).

### 5.5 Multi-appartenance
Déjà gérée : une personne peut être membre de **plusieurs équipes** (appartenance unique seulement
pour les familles). À faire côté écran : dans **Mes groupes**, un sélecteur en haut (« Groupe
musical · Protocole · Média ») et, dans Mon espace, l'agenda fusionne les répétitions de toutes
ses équipes avec la couleur de chacune.

---

## 6. Module Mon espace

Ordre des blocs (de haut en bas) :

1. Mes cotisations en cours
2. Dans ma famille et mes équipes (agenda fusionné, répétitions comprises)
3. Mes engagements et mes passages au programme
4. Mes dernières nouvelles
5. Mon parcours (formations, actes)
6. Mon code de présence (volet replié)
7. Ma maison
8. **Je vais m'absenter** — volet secondaire, en fin de page (le raccourci actuel en tête est retiré)

---

## 7. Architecture fonctionnelle

### 7.1 Écrans (routes)

| Route | Évolution |
| --- | --- |
| `/audiences` | Interrupteur Indisponible par jour ; écran « Prévenir les inscrits » |
| `/cultes` → titre « Programme de l'église » | Vue fidèle sans noms, fenêtre glissante |
| `/dons` | Trois cartes Dîme / Offrande / Don libéral, boutons Mobile Money |
| `/administration/parametres` | Nouveaux réglages : fenêtre du programme, canaux de dons, postes publics |
| `/famille` | Fil d'annonces combiné, « Prier ensemble maintenant », tenues |
| `/mes-groupes/[id]` | Caisse d'équipe, tenues, répétitions typées, sélecteur multi-équipes |
| `/mon-espace` | Nouvel ordre, absence en fin de page |

### 7.2 Fonctions de base (RPC, `security definer`)
`set_pastor_unavailable`, `set_pastor_available`, `notify_appointment_change`,
`program_view` (masquage des noms), `declare_gift` (évolue : `purpose`, `receiver`),
`confirm_tithe` (pasteur), `create_outfit`, `order_outfit`, `team_cash_balance`.

### 7.3 Tâches planifiées (cron quotidien existant)
Ajouts à la liste `JOBS` : `notify_rehearsal_reminders` (veille des répétitions),
`notify_outfit_deadlines` (3 jours avant la date limite des commandes).

### 7.4 Sécurité
- Toutes les nouvelles tables ont leurs règles RLS et un déclencheur de journal (`audit`).
- Tests RLS ajoutés : fidèle sans accès aux noms du programme ; dîme invisible hors pasteur ;
  caisse d'équipe illisible par une autre équipe ; tenue commandée seulement pour soi
  (ou par le bureau du groupe).
- Numéros de téléphone (pasteur, caissier) : réglages, jamais dans le code.

### 7.5 Coût
Tout fonctionne avec les offres gratuites. Restent payants et **désactivés par défaut** :
envoi automatique de SMS, API WhatsApp Business, paiement en ligne direct.

---

## 8. Décisions à confirmer par Jean-Pierre (et le pasteur)

| # | Question | Option A | Option B | Proposition |
| --- | --- | --- | --- | --- |
| D1 | Indisponibilité : bloquer un **jour entier** ou aussi des **créneaux** ? | Jour entier (simple) | Jour ou plage horaire | A |
| D2 | La dîme va au pasteur : la trésorerie la voit-elle ? | Le pasteur seul, rien dans la caisse de l'église | Le pasteur confirme, et la caisse enregistre le **total** (sans noms) pour les bilans | B (transparence des bilans) |
| D3 | Offrande à distance : quel destinataire par défaut ? | Caissier | Pasteur | Au choix du pasteur, caissier proposé |
| D4 | Programme : les fidèles voient-ils le **thème** du culte ? | Oui | Non | A |
| D5 | Caisse d'équipe : qui valide une dépense ? | Le responsable de l'équipe | Le responsable **et** la trésorerie de l'église au-delà d'un plafond | B |
| D6 | Tenues : paiement suivi comme une cotisation (reçu) ? | Oui | Non, simple pointage « payé » | A |

## 9. Ordre de réalisation proposé

1. Programme de l'église (renommage, masquage des noms, fenêtre) et Mon espace — rapide, visible.
2. Dons (trois cartes, numéros en réglage, motif du don libéral).
3. Audiences (indisponibilité, alerte groupée).
4. Équipes et Familles (répétitions typées, annonces combinées, prière instantanée).
5. Tenues et caisse d'équipe.

Chaque étape : migration, règles RLS et tests, écrans, essai sur téléphone, mise en ligne.
