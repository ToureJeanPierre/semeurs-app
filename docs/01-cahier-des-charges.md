# Cahier des charges fonctionnel — Application « Les Semeurs de la Parole »

Version consolidée du 24 octobre 2026. Concepteur : Jean-Pierre.

## 1. Contexte et problématique

L'Église évangélique Les Semeurs de la Parole (Yopougon Camp Militaire, carrefour Gandhi, Abidjan) veut une application unique pour piloter sa vie communautaire : membres, familles, équipes, cellules, suivi des âmes, programme des cultes et finances.

Aujourd'hui le suivi repose sur la mémoire des responsables. Un fidèle peut manquer deux, trois dimanches, voire un mois, sans que personne ne s'en aperçoive : l'église perd des âmes faute de suivi. Les cotisations, les engagements de dons et la caisse sont tenus sur cahiers ou fichiers dispersés, sans savoir qui a donné et qui n'a pas donné.

La difficulté centrale est organisationnelle : une même personne peut être assistant pasteur, père de famille, chantre et jeune à la fois. Le système doit gérer des rôles cumulables et des périmètres de visibilité qui se croisent.

## 2. Objectifs et indicateurs

Objectif premier : qu'aucun fidèle absent plus de 14 jours ne reste sans contact d'un responsable.

| Objectif | Indicateur | Cible à 6 mois |
| --- | --- | --- |
| Réduire les pertes de fidèles | % d'absents ≥ 2 semaines contactés sous 72 h | ≥ 90 % |
| Centraliser le registre | % de fiches complètes (contact, commune, famille) | ≥ 95 % |
| Intégrer les nouveaux | Délai entre première visite et rattachement à une famille | ≤ 30 jours |
| Fiabiliser les cotisations et engagements | Versements saisis avec reçu numérique | 100 % |
| Rendre la caisse transparente | Rapport mensuel généré automatiquement | 12/12 mois |
| Outiller les équipes | Équipes publiant leur programme dans l'appli | 100 % |

Objectif secondaire : donner au pasteur une vision globale en temps réel pour savoir où agir et quoi améliorer.

## 3. Acteurs et structure de l'église

- **Direction** : le Bishop fondateur (Londres), le pasteur résident (Abidjan) et ses assistants. Un assistant pasteur peut aussi être père de famille.
- **Familles** : l'église est subdivisée en familles (5 au départ, nombre libre). Chaque famille a un père de famille qui suit ses membres, et qui peut déléguer le suivi d'un sous-groupe à des membres matures (souvent par commune).
- **Non rattachés** : nouveaux venus, personnes pas encore orientées ou qui préfèrent attendre avant d'intégrer une famille.
- **Équipes** (transverses aux familles) : chantres et musiciens, protocole, évangélisation, intercession, et toute équipe future. Chaque équipe a un responsable, un adjoint et des membres.
- **Jeunesse** : cadre d'expression et d'activités pour les jeunes (14 à 50 ans par défaut), même s'ils sont déjà dans d'autres équipes.
- **Cellules** : réunions de prière par quartier, le mardi, avec leurs responsables.
- **Caisse** : les caissiers (3 au départ) comptent les offrandes, font le point des offrandes, des cotisations et des engagements.
- **Modérateurs et prédicateurs** : conduisent et prêchent aux cultes, selon un programme établi par un assistant pasteur.
- **Administrateur** : désigné par le pasteur, il paramètre l'application.
- **Fidèles** : utilisent eux aussi l'application (espace fidèle).

## 4. Principe fondateur : tout se configure, rien ne se recode

Quand l'église crée un nouveau ministère, l'administrateur clique sur « Ajouter une équipe » et la nouvelle équipe fonctionne immédiatement avec toutes les capacités des autres, sans développeur.

Trois briques génériques :

- **Le groupe** : familles, équipes, cellules, Jeunesse, classes d'école du dimanche sont des groupes. Un groupe a un type, un nom, une couleur, un bureau (fonctions configurables) et des membres.
- **Les capacités** : fonctions cochées par groupe, branchées automatiquement.
- **Les paramètres** : listes de valeurs, seuils, modèles de messages, circuits de validation, modules actifs.

| Capacité | Apport au groupe |
| --- | --- |
| Agenda | Activités récurrentes ou ponctuelles |
| Présences et alertes | Pointage et alertes d'absence, seuils propres |
| Cotisations | Rubriques, versements, relances |
| Engagements | Promesses de dons et suivi |
| Formations | Programme, supports, progression |
| Planning de service | Postes à pourvoir par activité, roulement |
| Répertoire de ressources | Chants, textes, documents, audio |
| Chaîne de prière | Créneaux par roulement, sujets de prière |
| Inventaire | Matériel confié au groupe |
| Rapports d'activité | Formulaire rempli après chaque rencontre |
| Annonces | Messages ciblés aux membres |

| Ce que l'administrateur ajoute sans code | Exemple |
| --- | --- |
| Type de groupe | Équipe des femmes, équipe médias |
| Rôle et ses droits | « Responsable logistique » : droits cochés, périmètre choisi |
| Champ personnalisé de la fiche fidèle | Profession, langue parlée |
| Liste de valeurs | Statuts, motifs d'absence, catégories de dépense |
| Type de culte ou d'activité | Veillée, croisade, avec ses postes à pourvoir |
| Étape d'intégration | « Rencontre avec le pasteur » |
| Seuils d'alerte | 7 / 14 / 21 / 30 jours |
| Modèle de message | Bienvenue, relance, anniversaire |
| Circuit d'approbation | Plafond de dépense, nombre de validateurs |
| Module | Activer ou désactiver un module entier |
| Indicateur du tableau de bord | Chiffres affichés au pasteur |

## 5. Liste des modules

| # | Module | Lot |
| --- | --- | --- |
| M1 | Registre des personnes | 1 |
| M2 | Familles et délégation du suivi | 1 |
| M3 | Présences et alertes d'absence | 1 |
| M4 | Suivi des âmes et évangélisation | 2 |
| M5 | Cotisations | 2 |
| M6 | Équipes et ministères | 2 |
| M7 | Jeunesse | 3 |
| M8 | Caisse et engagements financiers | 3 |
| M9 | Agenda, communication, tableau de bord | transversal |
| M10 | Programmation des cultes (modérateurs, prédicateurs) | 2 |
| M11 | Cellules | 2 |
| M12 | Espace pastoral | 1 |
| M13 | École du dimanche | 4 |
| M14 | Événements de vie | 2 |
| M15 | Anniversaires et messages automatiques | 1 |
| M16 | Médiathèque des prédications | 4 |
| M17 | Inventaire du patrimoine | 4 |
| M18 | Formations et parcours | 4 |
| M19 | Registre des actes | 4 |
| M20 | Sondages internes | 4 |
| M21 | Espace fidèle (dont localisation du domicile) | 1 |
| M22 | Réunions (présentiel et en ligne) | 2 |
| M23 | Messagerie et diffusion groupée | 1 |
| — | Moteur de groupes, capacités et paramètres | 1 (socle) |

## 6. M1–M3 : Membres, familles et présences

### 6.1 Fiche fidèle
- Identité : nom, prénoms, sexe, date de naissance, photo.
- Contacts : téléphone principal, WhatsApp, téléphone d'un proche.
- Localisation : commune, quartier, repère, position GPS (voir 14.2).
- Vie spirituelle : date d'arrivée, baptême, « amené par » (gagneur d'âme).
- Statut : visiteur, nouveau converti, en intégration, membre, inactif, parti, décédé.
- Situation familiale, liens avec d'autres fidèles (conjoint, enfants).
- Champs personnalisés définis par l'administrateur.

### 6.2 Familles
- Créées par l'administrateur, en nombre libre (5 au départ). Père de famille choisi parmi les membres ; éventuellement mère de famille ou adjoint.
- Un fidèle appartient à 0 ou 1 famille. Les non-rattachés forment un vivier visible du pasteur, des assistants et de l'évangélisation, avec un motif (nouveau, en attente volontaire, pas encore orienté).
- Transferts entre familles historisés.

### 6.3 Délégation du suivi
- Le père de famille nomme des délégués et leur confie un sous-groupe (souvent par commune). Le délégué ne voit que ses fidèles. Délégation révocable, avec date de fin possible. Le père de famille voit les actions de ses délégués.

### 6.4 Pointage
- Séances : tous les cultes et activités de l'agenda.
- **Deux modes retenus** : liste à cocher tenue par le protocole, et QR code personnel scanné à l'entrée. Saisie après coup possible par le père de famille.
- Fonctionne hors connexion, synchronisé ensuite.
- Absence justifiée (voyage, maladie, travail) avec dates : suspend les alertes.

### 6.5 Alertes d'absence

| Niveau | Seuil (paramétrable) | Visuel | Notifiés |
| --- | --- | --- | --- |
| Normal | < 7 jours | Pastille verte | — |
| Attention | ≥ 7 jours | Pastille orange | Délégué et père de famille |
| Urgent | ≥ 14 jours | Voyant rouge clignotant | Père de famille, rappel quotidien |
| Critique | ≥ 21 jours | Rouge clignotant + badge | + assistant pasteur référent |
| Perdu de vue | ≥ 30 jours | Liste « Âmes à reconquérir » | + pasteur et responsable évangélisation |

- Fidèle sans famille : notifications au responsable de l'évangélisation et au gagneur d'âme.
- **Cultes de semaine** : ils comptent autant que le dimanche. Le père de famille peut marquer un fidèle « dispensé des cultes de semaine » (éloignement, horaires de travail) : seules ses absences du dimanche déclenchent alors les alertes.
- Une notification n'est envoyée qu'au changement de niveau.

### 6.6 Actions de suivi
- Depuis l'alerte : appeler, WhatsApp, SMS, itinéraire.
- Journal de suivi : date, canal, résultat (joint, injoignable, malade, déménagé, découragé…), note, prochaine action.
- Une alerte est « traitée » dès qu'un contact est noté ; elle se clôt au retour du fidèle.
- Notes sensibles visibles du seul père de famille et du pasteur.

## 7. M4 : Suivi des âmes et évangélisation

Une âme peut être suivie par plusieurs personnes à la fois :

| Lien | Portée |
| --- | --- |
| Père de famille | Sa famille |
| Délégué | Son sous-groupe |
| Responsable évangélisation | Toutes les âmes |
| Gagneur d'âme | Les personnes qu'il a amenées |
| Membre évangélisation assigné | Une âme précise |

Tous partagent le même journal de suivi (on voit qui a déjà appelé).

Parcours d'intégration (étapes paramétrables) : fiche rapide à la première visite, message de bienvenue le jour même, appel sous 72 h, nouvelle naissance, cours des nouveaux convertis, baptême, intégration famille, intégration équipe.

Activités : sorties d'évangélisation (date, zone, équipe), contacts terrain convertibles en fiches, statistiques par sortie et par gagneur.

## 8. M5 et M8 : Cotisations, caisse et engagements

### 8.1 Cotisations
- Rubriques : mariage, décès, naissance, maladie, cotisation mensuelle d'équipe, événement, projet (types extensibles).
- Paramètres : bénéficiaire, portée (famille, groupe, église), montant fixe ou libre, minimum, échéance, récurrence, objectif.
- Encaissement : espèces, Orange Money, MTN MoMo, Moov Money, Wave. Saisie par la trésorière, ou déclaration par le fidèle avec référence puis validation.
- Reçu numérique numéroté. Paiements partiels. Relances groupées. Bilan PDF à la clôture.

### 8.2 Caisse de l'église
- **Onglet Caisse** : l'administrateur affecte les caissiers (3 au départ) en les choisissant parmi les membres.
- Recettes : offrandes et dîmes par culte avec comptage à deux personnes et procès-verbal (billets et pièces par coupure) ; dons, actions de grâce, collectes.
- **Dîmes** nominatives ou anonymes au choix du fidèle ; le pasteur suit les dîmes nominatives par fidèle et par période ; attestation annuelle.
- Dépenses : demande avec justificatif photographié, circuit demandeur → caissier → pasteur au-delà d'un plafond paramétrable.
- Comptes : espèces, banque, Mobile Money. Budget annuel par catégorie. Arrêté mensuel verrouillé. Rapports PDF et Excel.
- Principe des quatre yeux : celui qui saisit n'est pas celui qui valide.

### 8.3 Engagements (promesses de dons)
- La caisse lance une campagne (objectif, dates).
- Devant le nom du fidèle, choisi dans la liste des membres : montant promis, date butoir, échéancier éventuel.
- Versements imputés ; reste dû et taux calculés ; statuts automatiques (à jour, échéance proche, en retard, soldé).
- Relances automatiques. Signalement des retards au père de famille **activable ou non par l'administrateur**.
- Engagements anonymes possibles. Le pasteur voit en temps réel promis, encaissé, taux de réalisation.

## 9. M6 et M7 : Équipes et Jeunesse

Socle commun à toute équipe : bureau, agenda (récurrences), présences et alertes, cotisations, formations, annonces.

| Équipe | Spécificités |
| --- | --- |
| Chantres et musiciens | Chantres et instrumentistes (instrument), répertoire des chants (tonalité, paroles, audio), programme des chants par culte, planning de louange, inventaire des instruments |
| Protocole | Planning de service par culte et par poste, tenue du pointage, registre des visiteurs |
| Intercession | Chaîne de prière par roulement, mur de sujets de prière (option confidentielle), suivi « prière exaucée », programme des jeûnes |
| Évangélisation | Voir M4 |

Jeunesse : appartenance automatique 14–50 ans (modifiable) + ajouts manuels ; activités, inscriptions, participation aux frais, boîte à idées, sondages.

## 10. M10–M12 : Cultes, cellules et espace pastoral

### 10.1 Calendrier des cultes (programme réel en `docs/05`)
- Cultes récurrents paramétrés (vendredi et dimanche, jours et heures modifiables).
- Programmes exceptionnels : veillée, croisade, convention, jeûne, action de grâce.
- Chaque culte génère ses postes : modérateur, prédicateur, louange, protocole, intercession.

### 10.2 Programme de modération et de prédication
- Viviers de modérateurs (dimanche, semaine, les deux) et de prédicateurs, sélectionnés parmi les membres.
- Génération sur **2, 3 ou 6 mois** (durée au choix), répartition équitable par roulement, ajustable à la main.
- Contrôles : pas deux fois la même personne le même jour, indisponibilités respectées, alerte si un poste est vide.
- Thème et texte biblique du prédicateur. Publication, rappels J-3 et J-1, échanges de tour validés, historique pour l'équité.

### 10.3 Cellules
- Créées par l'administrateur : nom, lieu (quartier, adresse, repère, GPS), hôte, responsable, adjoint, jour et heure (mardi par défaut).
- Rattachement des fidèles par quartier, indépendamment de la famille.
- Rapport après chaque réunion : présents, nouveaux, thème, sujets de prière, besoins. Nouveaux venus envoyés dans le parcours d'intégration.
- Programme d'étude commun ; statistiques ; alerte si pas de rapport depuis 2 semaines.

### 10.4 Espace pastoral
- **Audiences du mercredi**, de 14 h à 19 h 30 par défaut : créneaux, demande de rendez-vous avec motif, confirmation, notification.
- Dossiers de cure d'âme chiffrés, visibles du seul pasteur.
- Vue d'ensemble : effectif, présences, alertes par famille, intégrations, cellules, finances, engagements.
- Vue « qui fait quoi » par fidèle. Programme personnel du pasteur.

### 10.5 Agenda consolidé
Toutes les activités dans un calendrier unique filtrable, détection des conflits de salle ou de personne, programme personnel de chaque fidèle.

## 11. M13–M20 : Modules complémentaires

- **M13 École du dimanche** : classes par âge, moniteurs, fiche enfant liée aux parents, personnes autorisées à récupérer l'enfant, présences, leçons.
- **M14 Événements de vie** : naissance, mariage, deuil, hospitalisation… signalés au père de famille et au pasteur ; ouverture en un clic d'une cotisation de soutien ou d'une visite.
- **M15 Anniversaires** : messages automatiques (naissance, mariage, baptême), liste hebdomadaire aux pères de famille.
- **M16 Médiathèque** : prédications audio/vidéo, notes, recherche par thème, texte, prédicateur.
- **M17 Inventaire** : biens, valeur, état, groupe responsable, mouvements, rappels d'entretien.
- **M18 Formations** : parcours (nouveaux convertis, baptême, responsables), sessions, progression, attestation.
- **M19 Registre des actes** : baptêmes, mariages, présentations d'enfants, certificats numérotés.
- **M20 Sondages** : ciblés, anonymes ou nominatifs, résultats en temps réel.

## 12. M21–M23 : Espace fidèle, réunions, messagerie

### 12.1 Espace fidèle
Le fidèle : met à jour ses infos, enregistre sa maison, voit son agenda (cultes, cellule, ses passages comme modérateur ou prédicateur), affiche son QR code de présence, déclare une absence, suit ses cotisations, engagements et reçus, paie par Mobile Money, demande un rendez-vous au pasteur, dépose un sujet de prière, signale un événement de vie, écoute les prédications, s'inscrit aux activités. Un fidèle sans smartphone reste géré par ses responsables.

### 12.2 Localisation du domicile
- Bouton « Je suis à la maison : enregistrer ma position » : géolocalisation du navigateur, confirmation sur carte.
- Pour un fidèle sans l'appli : lien à usage unique envoyé par WhatsApp, page légère qui capte la position.
- Le père de famille peut l'enregistrer lors d'une visite.
- Consentement explicite ; modifiable ou supprimable par le fidèle.
- Visible uniquement du père de famille, du délégué, du pasteur et des assistants.
- Bouton « Itinéraire » vers Google Maps ; carte de la famille par commune pour organiser une tournée.

### 12.3 Réunions
- Création par le pasteur, un père de famille ou un responsable : objet, date, ordre du jour, mode (présentiel, en ligne, hybride), lieu.
- Invités en un clic (famille, équipe, cellule, responsables, sélection), réponses, rappels.
- En ligne : salle Jitsi Meet intégrée (gratuite) ou lien Google Meet / Zoom.
- Après : présences, compte rendu, décisions, tâches avec échéance.

### 12.4 Messagerie et diffusion groupée
- Besoin principal : écrire une fois, envoyer à une liste (ex. rappel du culte aux âmes gagnées).
- Listes prêtes selon le rôle : mes âmes gagnées, ma famille, mon sous-groupe, ma cellule, mon équipe, absents de la semaine.
- Personnalisation `{prénom}`, envoi immédiat ou programmé.
- Canaux : notification de l'appli (gratuit, actif), **WhatsApp assisté** (gratuit, actif : l'appli prépare chaque message, un appui ouvre WhatsApp avec le texte prêt), API WhatsApp Business et SMS (payants, désactivés par défaut).
- Garde-fous : périmètre par rôle, limite d'envois, désinscription.
- Discussion interne (fils de groupe, messages privés) en lot 4.

## 13. Droits d'accès

Les droits combinent un **rôle** et un **périmètre**. Une personne cumule autant de couples que nécessaire ; ses droits effectifs sont leur union. G = gérer, V = voir, P = ses propres données.

| Rôle | Périmètre | Fiches | Alertes et suivi | Cotisations et engagements | Groupes | Programme cultes | Caisse | Paramètres |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Administrateur | Église | G | — | — | G | — | — | G |
| Pasteur | Église | G | V tout + cure d'âme | V | V | V + valide | V + approuve | V |
| Assistant pasteur | Église ou familles | G | V + G | V | V | V | V | — |
| Chargé du programme | Église | V | — | — | V | G | — | — |
| Modérateur / prédicateur | Lui-même | P | — | — | — | P | — | — |
| Père de famille | Sa famille | G | G | V | — | — | — | — |
| Délégué de suivi | Sous-groupe | V | G | — | — | — | — | — |
| Responsable évangélisation | Toutes les âmes | G | G | — | G équipe | — | — | — |
| Gagneur d'âme | Âmes amenées | V | G | — | — | — | — | — |
| Trésorière de famille | Sa famille | V | — | G | — | — | — | — |
| Responsable d'équipe | Son équipe | V | G équipe | G équipe | G | — | — | — |
| Responsable de cellule | Sa cellule | V | G cellule | — | G cellule | — | — | — |
| Responsable jeunesse | Jeunesse | V | G | G | G | — | — | — |
| Caissier | Église | V liste | — | G engagements | — | — | G | — |
| Fidèle | Lui-même | P | — | P | P | P | — | — |

**Administrateur** : désigné par le pasteur dans l'onglet Administration (choix parmi les membres, mot de passe, validation par le pasteur). Tous les droits de paramétrage. Le pasteur garde un accès complet en consultation et peut changer d'administrateur. Toute consultation de fiche et toute opération financière est journalisée.

## 14. Exigences non fonctionnelles

| Domaine | Exigence |
| --- | --- |
| Accessibilité | PWA installable, Android ≥ 8 et ordinateur, français, gros boutons, lisible par des aînés |
| Hors connexion | Pointage, fiches de sa famille, journal de suivi disponibles sans réseau |
| Performance | Écran principal < 3 s en 3G, chargement initial < 2 Mo |
| Capacité | 2 000 fidèles, 50 utilisateurs simultanés |
| Sécurité | Connexion téléphone + code SMS ou mot de passe, HTTPS, RLS, déconnexion après inactivité |
| Confidentialité | Loi ivoirienne n° 2013-450 (ARTCI), consentement, notes pastorales chiffrées |
| Traçabilité | Journal d'audit non modifiable (finances, accès aux fiches) |
| Disponibilité | 99 % mensuel, sauvegarde quotidienne |
| Notifications | Push d'abord, WhatsApp assisté, puis services payants si activés |
| Évolutivité | Tout nouvel élément par paramétrage (section 4) |

## 15. Décisions validées

| Point | Décision |
| --- | --- |
| Familles | Créées dans l'appli, nombre libre (5 au départ) |
| Seuils d'alerte | 7, 14, 21, 30 jours, modifiables |
| Cultes de semaine | Comptent autant que le dimanche, sauf fidèles dispensés |
| Caisse | 3 caissiers choisis parmi les membres, plafond paramétrable |
| Dîmes | Nominatives ou anonymes au choix ; le pasteur suit les nominatives |
| Jeunesse | 14 à 50 ans, modifiable |
| Pointage | Liste par le protocole et QR code |
| Équipes | Créées librement par l'administrateur |
| Hébergement et messages | Gratuit au départ, services payants activables plus tard |
| Administrateur | Désigné par le pasteur, mot de passe et validation |
| Programme de modération | 2, 3 ou 6 mois au choix |
| Cellules | Créées par l'administrateur |
| Audiences | Mercredi 14 h – 19 h 30 par défaut |
| Retards d'engagement | Signalement au père de famille activable par l'administrateur |
| Outils | Même chaîne que Restaurant Kalim (Claude Code, Vercel) |
| Phase pilote | Testée par Jean-Pierre et des testeurs de son choix |
| Connexion | Numéro + mot de passe, puis empreinte / schéma / code du téléphone (clé d'accès) ; aucun SMS au départ, code SMS activable plus tard (25/10/2026) |
| Postes sensibles | Empreinte ou schéma redemandés après inactivité ; reconfirmation avant les actions sensibles à partir du lot 1 (25/10/2026) |
| Base de données | Supabase sans Prisma ; schéma en migrations SQL versionnées (25/10/2026) |
