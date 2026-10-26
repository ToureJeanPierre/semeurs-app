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
| Vercel : projet, variables d'environnement, premier déploiement | À faire |
| Supabase : Site URL + Redirect URLs (`https://*.vercel.app/**`) | À faire après Vercel |
| Test sur le téléphone de Jean-Pierre (installation, connexion, empreinte) | À faire |

## Automatisation (demandée le 26/10/2026) — accès en place

État au 26/10/2026 : domaines réseau autorisés ; `SUPABASE_ACCESS_TOKEN` (limité au projet
semeurs-app, 30 jours) et `VERCEL_TOKEN` (portée : l'équipe Vercel « TOUR… », 30 jours)
ajoutés aux variables de l'environnement cloud « Default ». Le compte Vercel a une double
authentification (application Oracle Mobile Authenticator sur le téléphone de Jean-Pierre).

Prochaine action pour Claude Code : vérifier les deux jetons, puis faire seul les étapes
« À faire » du tableau ci-dessus, et donner à Jean-Pierre le lien Vercel pour le test.

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
