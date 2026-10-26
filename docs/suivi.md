# Suivi du projet

Journal tenu à jour par Claude Code pour qu'une nouvelle session reprenne exactement où la
précédente s'est arrêtée.

## Méthode de travail convenue avec Jean-Pierre

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
| Test sur le téléphone de Jean-Pierre (installation, connexion, empreinte) | À faire |

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

Prochaine action : finir le lot 0 avec Jean-Pierre, une étape à la fois : (1) installer l'appli sur
l'écran d'accueil, (2) activer l'empreinte depuis Profil, puis fusionner la branche dans `main`. sur le test téléphone, puis validation du lot 0.

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
