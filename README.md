# Les Semeurs de la Parole — application de l'église

Application de gestion de l'Église évangélique Les Semeurs de la Parole (Yopougon, Abidjan) :
suivi des fidèles et des absences, familles, équipes, cellules, cultes, cotisations, caisse,
engagements et espace fidèle.

- Besoin, architecture, design et plan : [`docs/`](docs/) (commencer par `CLAUDE.md`).
- Mise en place des comptes et des clés : [`docs/guide-mise-en-place.md`](docs/guide-mise-en-place.md).

## Pile technique

Next.js 16 (App Router, TypeScript strict) sur Vercel · Supabase (PostgreSQL + RLS, Auth, Storage)
· Tailwind CSS 4 · Framer Motion · PWA installable.

Connexion : numéro de téléphone + mot de passe, puis **clé d'accès** (empreinte, schéma ou code
du téléphone, standard WebAuthn) pour ouvrir et déverrouiller l'application. Aucun SMS.

## Travailler en local

```bash
npm install
cp .env.example .env.local   # puis renseigner les valeurs
npm run dev
```

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run lint` / `npm run typecheck` | Qualité du code |
| `npm test` | Tests de logique (Vitest) |
| `npm run test:e2e` | Parcours dans un navigateur (Playwright, après `npm run build`) |
| `npm run icons` | Régénère les icônes à partir de `assets/logo-semeurs.jpeg` |

## Organisation

```
src/app/            écrans (connexion, accueil, profil, déverrouillage) et routes API
src/components/     composants d'interface (ui/) et de connexion (auth/)
src/lib/            téléphone, session, verrou, clés d'accès, clients Supabase
src/proxy.ts        contrôle d'accès avant chaque page (session + verrou)
supabase/migrations schéma de la base, versionné
tests/              unit/ (Vitest) et e2e/ (Playwright)
```
