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

Prochaine action : retour de Jean-Pierre sur le test téléphone, puis validation du lot 0.

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
