# Guide de mise en place (lot 0)

Ce guide reprend, dans l'ordre, tout ce que Jean-Pierre fait lui-même. Les noms de boutons sont
en anglais, langue d'origine de Supabase et Vercel (désactiver la traduction automatique de
Chrome sur ces sites : elle casse leur affichage).

## Ce qui est déjà fait

- Dépôt GitHub privé `ToureJeanPierre/semeurs-app`.
- Projet Supabase `semeurs-app` (région Europe), RLS automatique activé,
  nouvelles tables non exposées par défaut.
- Adresse du projet : `https://mqarxjlmuvmpxnccpnrf.supabase.co`.

## 1. Supabase — réglages de connexion

**Authentication → Sign In / Providers → Email** :
- *Enable Email provider* : activé (c'est lui qui gère les comptes à mot de passe ; l'adresse
  est fabriquée à partir du numéro, la personne ne la voit jamais).
- *Confirm email* : **désactivé** (aucun e-mail n'est envoyé).
- *Minimum password length* (si proposé, **Authentication → Policies** ou **Passwords**) : 8.

**Authentication → Sign In / Providers → User Signups** :
- *Allow new users to sign up* : **désactivé**. Les comptes sont créés par l'église, pas
  par n'importe qui.

## 2. Supabase — créer la table des clés d'accès

**SQL Editor → New query**, coller tout le contenu de
`supabase/migrations/20261025000000_webauthn_credentials.sql`, puis **Run**.
Résultat attendu : « Success. No rows returned ».

## 3. Supabase — créer ton compte de test

**Authentication → Users → Add user → Create new user** :
- *Email* : `225` suivi de ton numéro à 10 chiffres, puis `@telephone.semeurs.invalid`
  (ex. pour 07 08 31 04 33 : `2250708310433@telephone.semeurs.invalid`) ;
- *Password* : un mot de passe d'au moins 8 caractères ;
- cocher **Auto Confirm User**.

Au lot 1, les comptes seront créés depuis l'application (fiche du fidèle), sans passer par ici.

## 4. Supabase — récupérer la clé secrète (à ne jamais partager)

**Project Settings → API Keys → Secret keys** : copier la clé `sb_secret_…`.
Elle ne se colle **que** dans Vercel (étape 5), jamais dans une conversation ni dans un fichier.

## 5. Vercel — mettre l'application en ligne

1. vercel.com → *Continue with GitHub* → offre **Hobby**.
2. **Add New → Project** → importer `semeurs-app` → laisser les réglages proposés (Next.js).
3. **Environment Variables**, cocher *Production* et *Preview* pour chacune :

| Nom | Valeur |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://mqarxjlmuvmpxnccpnrf.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | la clé `sb_publishable_…` |
| `SUPABASE_SECRET_KEY` | la clé `sb_secret_…` (étape 4) — **Sensitive** |
| `APP_LOCK_SECRET` | une longue phrase aléatoire d'au moins 32 caractères — **Sensitive** |

4. **Deploy**. Noter l'adresse obtenue (`https://….vercel.app`).

Chaque branche GitHub reçoit automatiquement sa propre adresse de prévisualisation.

## 6. Supabase — déclarer l'adresse de l'application

**Authentication → URL Configuration** :
- *Site URL* : l'adresse Vercel de l'étape 5 ;
- *Redirect URLs* : ajouter `https://*.vercel.app/**`.

## 7. Le test qui valide le lot 0

1. Sur ton Android, ouvrir l'adresse Vercel dans **Chrome**.
2. Menu **⋮ → Installer l'application** (ou *Ajouter à l'écran d'accueil*) : l'icône
   « Les Semeurs » apparaît.
3. Ouvrir l'appli depuis l'icône, se connecter avec ton numéro et ton mot de passe.
4. Sur l'accueil, **Activer maintenant** → poser le doigt ou tracer le schéma.
5. Profil → **Se déconnecter**, puis sur l'écran de connexion **Empreinte ou schéma** :
   tu entres sans mot de passe.
6. Laisser l'appli 30 minutes sans t'en servir, la rouvrir : elle demande l'empreinte ou le schéma.
