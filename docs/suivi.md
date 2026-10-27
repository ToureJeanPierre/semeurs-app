# Suivi du projet

Journal tenu à jour par Claude Code pour qu'une nouvelle session reprenne exactement où la
précédente s'est arrêtée.

## Méthode de travail convenue avec Jean-Pierre

**Depuis le 27/10/2026 : livraison par lot entier.** Claude Code termine tout un lot sans attendre
de validation entre les étapes, teste lui-même avec des comptes de démonstration, puis livre un
lien + une liste d'essais + la liste des choix faits (prudents et modifiables dans les réglages)
à confirmer. Jean-Pierre teste et renvoie une seule liste de corrections. Seules les décisions
réellement bloquantes lui sont posées en cours de lot.

- Une question ou une action à la fois, en français simple ; attendre sa réponse avant la suite.
- Jean-Pierre ne veut plus faire les réglages techniques à la main : dès que les accès sont en
  place (voir « Automatisation »), Claude Code s'en charge lui-même.
- Ne jamais demander de clé ou de mot de passe dans la conversation.

## Lot 0 — état au 26/10/2026

| Étape | État |
| --- | --- |
| Dépôt GitHub `ToureJeanPierre/semeurs-app` | Fait |
| Code du lot 0 (connexion mot de passe + empreinte/schéma, thème, PWA, tests) | Fait, sur `main` |
| Projet Supabase `semeurs-app` (réf. `mqarxjlmuvmpxnccpnrf`, Europe) | Fait |
| Supabase : inscriptions libres fermées, « Confirm email » désactivé | Fait |
| Migration `20261025000000_webauthn_credentials.sql` appliquée (RLS + 2 règles vérifiées) | Fait |
| Compte de test de Jean-Pierre (e-mail technique `225…@telephone.semeurs.invalid`) | Fait |
| Vercel : projet `semeurs-app` (équipe `toure5`) relié au dépôt, 4 variables, déploiement de `main` | Fait (26/10) |
| Supabase : Site URL `https://semeurs-app.vercel.app` + Redirect URLs (prod, `*-toure5.vercel.app`, localhost) | Fait (26/10) |
| Test sur le téléphone de Jean-Pierre (installation, connexion, empreinte) | Fait (26/10) : installée en plein écran, clé « Android · K », déverrouillage par schéma OK |

## Automatisation (demandée le 26/10/2026) — accès en place

État au 26/10/2026 : domaines réseau autorisés ; `SUPABASE_ACCESS_TOKEN` (limité au projet
semeurs-app, 30 jours) et `VERCEL_TOKEN` (portée : l'équipe Vercel « TOUR… », 30 jours)
ajoutés aux variables de l'environnement cloud « Default ». Le compte Vercel a une double
authentification (application Oracle Mobile Authenticator sur le téléphone de Jean-Pierre).

Le 26/10, les deux jetons ont été vérifiés et utilisés : projet Vercel créé, variables écrites
(`SUPABASE_SECRET_KEY` et `APP_LOCK_SECRET` en type « sensitive », production + preview),
déploiement de production prêt, Supabase réglé. Lien de test : https://semeurs-app.vercel.app

Notes :
- Le réseau de l'environnement cloud bloque `*.vercel.app` : Claude Code ne peut pas ouvrir le site
  lui-même, le test se fait sur le téléphone de Jean-Pierre.
- Les clés d'accès (empreinte) sont liées au nom de domaine : toujours tester sur
  `semeurs-app.vercel.app`, pas sur les liens de prévisualisation.
- Les déploiements de prévisualisation sont protégés par l'authentification Vercel (réglage par défaut).

- 26/10 : le compte de test avait un chiffre en trop dans son numéro (11 chiffres) ; adresse
  technique corrigée via l'API admin Supabase, mot de passe inchangé.

## Nouvel habillage animé (26/10/2026, demandé par Jean-Pierre)

Jean-Pierre s'est connecté avec succès, mais il a trouvé le design trop pauvre. Il a envoyé deux
maquettes : bleu roi et or, logo, bandeau lumineux, grille d'icônes, verset du jour, prochain culte.
Il a validé la proposition suivante, réalisée sur la branche `claude/wizardly-hypatia-uejff4` :

- Migration `20261026000000_home_configuration.sql` (appliquée) : `settings`, `service_types`,
  `daily_verses`, `modules`. Tout ce qu'affiche l'accueil vient de là (principe « tout se configure »).
- Accueil : bandeau animé (rayons qui oscillent, grains dorés qui montent, halo autour du logo),
  carte « Prochain culte » avec compte à rebours en direct, 6 raccourcis « Bientôt » (modules
  désactivés), verset du jour (12 versets Louis Segond 1910, un par jour), programme de la semaine.
- Connexion, déverrouillage et profil : même ciel animé. Barre du bas flottante avec pastille qui glisse.
  Transition douce entre les pages. `prefers-reduced-motion` respecté partout (MotionConfig + CSS).
- Tests : `tests/unit/services.test.ts`, `tests/unit/verses.test.ts`. RLS vérifiée à la main
  (anon : refusé ; authenticated : lecture seule, settings publics seulement).
- Production : déployée depuis cette branche via l'API Vercel (sans toucher à `main`).
  À fusionner dans `main` quand Jean-Pierre valide.
- À faire au lot 1 : écrans d'administration pour modifier ces paramètres ; RLS d'écriture pour l'admin.
- Les maquettes montrent aussi les cultes en direct, les dons en ligne et l'App Store : ce n'est pas
  au cahier des charges tel quel. À rediscuter avec Jean-Pierre le moment venu.

## Refonte d'après la maquette (26/10/2026, 2ᵉ passage)

Jean-Pierre n'était pas satisfait du 1ᵉʳ habillage. Il a demandé de reproduire **exactement le
téléphone de sa maquette** :
- barre du haut bleu roi : logo et « Église Évangélique / Les Semeurs de la Parole », cloche, et
  **trois points** qui ouvrent le menu complet (panneau latéral, tous les modules + déconnexion) ;
- bannière : Bible ouverte dans la lumière, ciel bleu, phrase en écriture manuscrite (police
  Dancing Script, ajoutée pour cette seule phrase). Dessinée en SVG (`HomeBanner.tsx`) : l'image
  générée par Canva n'a pas pu être téléchargée en grand (domaine `media.canva.com` bloqué) ;
- « Prochain culte » **discret** : une ligne avec « dans 4 j 9 h », plus de gros compte à rebours ;
- grille 3 × 2 de carrés bleus (Prédications, Cultes, Annonces / Prières, Événements, Dons) ;
- verset du jour dans une carte blanche ; programme de la semaine retiré de l'accueil ;
- barre du bas alignée : Accueil, Prédications, Événements, Profil (configurable : `modules.nav_position`).
- Les modules non livrés ouvrent une page « Bientôt disponible » (`/m/[code]`).

## 3ᵉ passage (26/10/2026)

Retours de Jean-Pierre : le menu est en **trois traits à gauche** (pas trois points) ; la bannière doit
être une **photo**, pas un dessin ; la phrase de la bannière est remplacée par le **verset du jour** ;
le logo n'est **pas entouré de blanc**.
- Fait : bouton menu à gauche (panneau qui glisse depuis la gauche), logo détouré en cercle
  transparent (`public/logo-semeurs.webp`, service worker passé en v2), verset du jour sur la
  bannière (taille adaptée à la longueur), carte « Verset du jour » retirée.
- Bannière : photo envoyée par Jean-Pierre (Bible ouverte, ciel bleu), compressée en WebP 1280 px
  (46 Ko) dans `public/images/banniere-accueil.webp` ; `home_banner.image_url` renseigné en base.
  `images/` exclu du proxy d'authentification. Le dessin SVG reste en secours si `image_url` est vide.
  Plus tard (lot 1, administration) : téléversement de la photo dans le stockage Supabase.

- 4ᵉ retour : « C'est beaucoup mieux ». Ajouts : titre « Jésus-Christ t’aime » au-dessus du verset
  (paramètre `home_banner.headline`) et petite étiquette « Verset du jour » avant le verset.

- 5ᵉ retour : titre dans le style de l'affiche (« Jésus-Christ » en lettres rondes Comfortaa,
  « t’aime » en manuscrit, doré) ; « Verset du jour : » placé à gauche, suivi du verset.
- **Lenteur signalée** (quelques secondes à chaque écran). Cause : fonctions Vercel aux États-Unis
  (`iad1`) alors que Supabase est en Irlande (`eu-west-1`) → plusieurs allers-retours
  transatlantiques par page. Corrigé : région `dub1` (Dublin) dans `vercel.json` et dans le projet
  Vercel. En plus : animations d'entrée raccourcies, `app/loading.tsx` (affichage immédiat).

- 6ᵉ retour : bannière moins haute ; carte « Prochain culte » sous la bannière (plus de
  chevauchement), en dégradé or → orange avec reflet animé ; icône Prières = mains jointes
  (`hands-praying`, dessinée dans `icons.tsx`, absente de Lucide), Dons = main au cœur.

- 7ᵉ retour : le « h » de « 18 h » passait à la ligne → espaces insécables dans `formatTime`
  et ligne tronquée. **Page blanche 1–2 s** en passant à Accueil / Profil : chaque page reconstruisait
  tout l'écran. Corrigé : groupe de routes `app/(app)/` avec un `layout.tsx` commun (barre du haut et
  du bas persistantes, titre déduit de l'adresse), onglets préchargés (`prefetch`),
  `experimental.staleTimes` (60 s), animations de la bannière raccourcies. Mesuré en local :
  changement d'onglet en 50–100 ms.

- **Accueil validé par Jean-Pierre** (« C'est bon »), navigation fluide confirmée sur son téléphone.

## Lot 0 validé (26/10/2026)

Jean-Pierre a installé l'appli (plein écran), créé sa clé d'accès (Android demande le schéma à la
création, c'est normal) et rouvert l'appli verrouillée avec son schéma. **Lot 0 validé.**
Correctif : le bouton « Ajouter ce téléphone » est masqué sur un téléphone déjà enregistré
(il proposait une clé en double).

Fusion dans `main` autorisée par Jean-Pierre et faite (avance rapide, commit `e309b0c`), après
correction de la CI : `npm run typecheck` lance d'abord `next typegen` (PageProps / LayoutProps
manquaient sur GitHub). CI verte. Vercel déploie désormais `main` en production automatiquement.

## Lot 1 — démarré le 26/10/2026 (validé par Jean-Pierre)

Étapes annoncées : (1) socle « tout se configure », (2) fidèles et familles + délégation,
(3) pointage liste/QR hors connexion, (4) alertes d'absence, (5) espace fidèle / « Je suis à la
maison » / anniversaires / messages / audiences, (6) RLS complètes + comptes de démonstration.

### Étape 1 — socle (fait, en attente du test de Jean-Pierre)
- Migrations `20261027000000_core_engine.sql` et `20261027010000_admin_module.sql` (appliquées).
- Modèle des droits : rôle d'église (vaut partout) ou fonction dans un groupe (vaut dans le groupe).
  Catalogue `permissions` : settings.manage, roles.manage, groups.manage, people.view,
  people.manage, alerts.view, alerts.manage, audit.view.
- Écrans `/administration` : groupes (ajouter famille/équipe/cellule…, couleur, capacités à cocher,
  bureau choisi dans la liste des membres, membres), personnes (ajout rapide), rôles d'église,
  paramètres (seuils d'alerte). Module « Administration » visible selon les droits.
- Tests RLS : `tests/rls/core-engine.test.ts` (5 scénarios, base réelle, sans trace).
- Testé de bout en bout en local avec un compte administrateur temporaire, puis données de test
  supprimées (le journal d'audit, lui, n'est jamais modifié : il garde la trace de ces essais).
- 26/10 : avec l'accord explicite de Jean-Pierre, il est inscrit au registre (« Jean-Pierre
  Touré », +2250778016695), son compte y est rattaché (`public.users`) et il a le rôle
  **Administrateur** pour la phase de test.
- Plus tard : désignation de l'administrateur « validée par le pasteur » (docs/01 §13) ;
  capacités toutes marquées « Bientôt » tant qu'elles ne sont pas livrées.

- 27/10 : Jean-Pierre a désigné un père de famille (Famille 1) et créé « EQUIPE MÉDIA » avec
  lui comme responsable : OK. **Étape 1 validée.**
- Incident observé une fois : dans Groupes, toucher une équipe « ne faisait rien ». Les journaux
  Vercel montrent les requêtes reçues et servies (200, ~0,2 s) ; non reproduit en local. Après
  fermeture complète de l'appli, tout fonctionne. Hypothèse : appli restée ouverte pendant un
  redéploiement (version du navigateur ≠ version du serveur). À surveiller ; si ça revient,
  ajouter un rechargement automatique quand une nouvelle version est en ligne.
- Question de Jean-Pierre : comment un membre voit son équipe → proposé : page « Mes groupes »
  dans l'espace du fidèle dès l'étape 2, avec la création des comptes des membres.

### Étape 2 — fidèles et familles (fait, en attente du test de Jean-Pierre)
- Migration `20261027100000_people_families.sql` (appliquée).
- `/fideles` (registre, recherche, filtre « sans famille ») et `/fideles/nouveau` : droit d'église
  « people.view » / « people.manage ». `/fideles/[id]` : fiche complète (RLS), boutons Appeler /
  WhatsApp, groupes, modification si `can_manage_person`, **accès à l'appli** (création du compte
  avec mot de passe de départ affiché une fois, ou nouveau mot de passe), transfert de famille
  (administrateur, historique conservé).
- `/famille` : pères / mères / adjoints voient leur famille, inscrivent un nouveau membre
  (`add_person_to_group`), confient un sous-groupe à un délégué ; le délégué voit « Fidèles qui me
  sont confiés » (lecture seule).
- `/mes-groupes` : chaque fidèle voit ses groupes, le bureau, et les noms des membres si le type le
  permet (`group_types.members_see_each_other` : vrai pour équipes, cellules, Jeunesse ; faux pour
  familles et classes — **à confirmer par Jean-Pierre**).
- Profil : changement de mot de passe (vérifie l'ancien).
- Comptes : créés avec la clé secrète **après** vérification `can_manage_person`, opération
  inscrite au journal (`audit_log`, table « auth.users »).
- Tests : 4 scénarios RLS de plus (`tests/rls/families.test.ts`), générateur de mot de passe testé ;
  parcours complet vérifié en local (administrateur, père de famille, délégué), données de test
  supprimées ensuite.
- Reste pour plus tard : liens familiaux (conjoint, enfants), champs personnalisés, photo,
  position GPS du domicile (étape 5, « Je suis à la maison »).

- 27/10, compte rendu de Jean-Pierre : création d'une fiche, de l'accès, mot de passe de départ et
  rattachement à une famille : OK. Demandes : (1) un bouton pour terminer et revenir à la liste
  → `DoneLink` « Terminer et revenir à la liste » (fiche) et « … aux groupes » (groupe) ;
  (2) l'appli ne doit pas se fermer → la flèche Retour mène à l'écran parent (`parentPath`), et non
  plus à la page précédente de l'historique (sans historique, Android fermait l'appli) ;
  (3) « navigation logique et progressive » : son message était coupé, suite demandée.
  `/fideles` est ouvert à quiconque voit des fiches (le père de famille n'y voit que les siens, RLS).

- Suite du compte rendu (navigation « comme Yango ») : la flèche Retour doit refaire le chemin
  réellement parcouru, une étape à la fois, et rouvrir le menu (trois traits) pour un écran ouvert
  depuis le menu. Fait : **fil d'Ariane** (`src/lib/nav-trail.ts`, logique pure testée, 8 cas ;
  `src/components/layout/NavTrail.tsx`, branchement). Le fil suit l'historique du téléphone : la
  flèche de l'appli et le bouton Retour d'Android font la même chose (retour reconnu quand on
  arrive sur l'écran juste avant ; les onglets du bas sont marqués comme nouvel écran). Sans écran
  précédent, la flèche remonte à l'écran parent (`parentPath`) au lieu de quitter l'appli.
  « Terminer » revient à la liste en remontant le chemin (pas de boucle) ; un formulaire
  « nouveau » déjà envoyé est sauté au retour. Vérifié en local sur 5 parcours.
- Base réelle : Jean-Pierre et « Flore » (personne de test créée par Jean-Pierre, compte, Famille 2).

- 27/10, retours de Jean-Pierre :
  1. Lancement « comme Yango » : `SplashScreen.tsx` (CSS pur, rendu dans le HTML, une fois par
     ouverture : logo, balayage de lumière, sortie vers le haut ; masqué si mouvement réduit) ;
     `manifest.background_color` passé au bleu roi. Écran de déverrouillage épuré (fond bleu, logo,
     grand bouton empreinte) ; la demande d'empreinte/schéma part d'elle-même une fois l'appli prête
     (après le lancement, appli au premier plan) ; un refus de cette demande automatique n'affiche
     plus « Opération annulée ».
  2. Plus de cadre bleu dans les champs : contour gris discret (`border-ink/40`), pas d'`outline`
     sur input/select/textarea (les boutons et liens gardent l'indicateur clavier).
  3. Question : importer depuis le répertoire du téléphone → possible sur Android avec Chrome
     (Contact Picker API, `navigator.contacts.select`) ; non codé, en attente de son accord.
  4. Fiche après création : bannière « Fiche créée » (`?cree=1`), résumé en lecture, formulaire
     derrière « Modifier la fiche » (bouton « Enregistrer les modifications »).
- Base réelle : Jean-Pierre, Flore Zago, Jean Kouassi, Rodrigue Delo (saisis par Jean-Pierre).

- « Choisir dans mes contacts » (accord de Jean-Pierre) : `ContactPickerButton.tsx` (API Contact
  Picker de Chrome Android, invisible ailleurs), logique `lib/contact-import.ts` testée (premier mot
  = nom, reste = prénoms, premier numéro ivoirien valide), bouton « Inverser nom et prénom ».
  Présent sur Nouvelle fiche / Modifier la fiche, Ma famille → Inscrire, Administration → Personnes.
  Vérifié en local avec un répertoire simulé.

- Jean-Pierre : « c'est bon, ça peut aller » ; demande d'accélérer → nouvelle méthode (ci-dessus).

Prochaine action : terminer tout le lot 1 (pointage, alertes, espace fidèle, domicile,
anniversaires, messages groupés, audiences, comptes de démonstration), puis livrer. sur le test téléphone, puis validation du lot 0.

Pour que Claude Code fasse lui-même Vercel et Supabase, l'environnement cloud doit :

1. **Autoriser le réseau** vers : `api.supabase.com`, `*.supabase.co`, `mcp.supabase.com`,
   `api.vercel.com`, `vercel.com`.
2. **Contenir deux jetons** (variables d'environnement de l'environnement cloud) :
   - `SUPABASE_ACCESS_TOKEN` : supabase.com → Account → Access Tokens ;
   - `VERCEL_TOKEN` : vercel.com → Account Settings → Tokens.

Avec ces accès, une session peut : lire les clés API du projet via l'API de gestion Supabase,
créer le projet Vercel lié au dépôt, y écrire les variables (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `APP_LOCK_SECRET` généré
aléatoirement), déployer, puis régler Site URL / Redirect URLs dans Supabase — sans qu'aucune
clé ne passe dans la conversation.
