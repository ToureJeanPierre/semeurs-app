# Plan de développement

Chaque lot se termine par une version publiée sur le lien Vercel, testée par Jean-Pierre et ses testeurs, puis validée avant de passer au suivant. Les durées dépendent du rythme de Jean-Pierre ; l'ordre, lui, est fixe.

## Lot 0 — Mise en place

- Projet Next.js + TypeScript + Tailwind + Framer Motion, dépôt Git.
- Projet Supabase (offre gratuite), connexion du projet, variables d'environnement documentées pas à pas pour Jean-Pierre.
- Déploiement Vercel avec prévisualisation par branche.
- Thème (couleurs, polices, composants de base) selon `03-design.md`, logo intégré, manifeste PWA et icônes.
- Page de connexion par téléphone.

**Validé quand** : Jean-Pierre ouvre le lien sur son téléphone, installe l'appli sur l'écran d'accueil et se connecte.

## Lot 1 — Socle et suivi des absences (le plus important)

- Moteur de groupes, types de groupes, fonctions, capacités, rôles et affectations, paramètres, listes de valeurs.
- Écrans d'administration : créer une famille, une équipe, une cellule ; affecter des responsables depuis la liste des membres ; désigner l'administrateur.
- Registre des personnes (M1), familles et délégation (M2).
- Pointage liste + QR, hors connexion (M3).
- Calcul quotidien des alertes et notifications, dispense des cultes de semaine.
- Fiche fidèle, journal de suivi, appel / WhatsApp / itinéraire.
- Espace fidèle de base et « Je suis à la maison » + lien de position (M21).
- Messages groupés : notifications de l'appli et WhatsApp assisté (M23).
- Anniversaires (M15). Audiences du mercredi dans l'espace pastoral (M12).
- Règles RLS et leurs tests. Script de seed (église réelle + données fictives + comptes de démonstration par rôle).

**Validé quand** : sur une famille pilote, pendant 2 à 3 dimanches, les absents apparaissent avec le bon niveau, le père de famille les contacte depuis l'appli, et un délégué ne voit que son sous-groupe.

## Lot 2 — Âmes, équipes, cultes, cotisations

- Suivi des âmes et évangélisation, parcours d'intégration (M4).
- Capacités d'équipe complètes : agenda, présences, planning de service, répertoire, chaîne de prière (M6), cellules et rapports (M11).
- Programme des cultes, modérateurs et prédicateurs sur 2, 3 ou 6 mois (M10).
- Cotisations et reçus (M5). Événements de vie (M14). Réunions avec Jitsi (M22).

**Validé quand** : l'assistant pasteur génère un programme de 3 mois, une cotisation de soutien est lancée et suivie, une réunion de famille se tient en ligne avec compte rendu.

## Lot 3 — Caisse, engagements, jeunesse, pilotage

- Caisse : offrandes par coupures, dîmes, dépenses avec approbation, comptes, arrêtés mensuels, rapports (M8).
- Campagnes et engagements avec relances (M8).
- Jeunesse (M7). Tableau de bord du pasteur complet (M9, M12).

**Validé quand** : un mois complet de caisse est tenu dans l'appli et le rapport mensuel sort automatiquement.

## Lot 4 — Modules complémentaires

Ordre par défaut, ajustable : événements avancés, médiathèque (M16), formations (M18), registre des actes (M19), école du dimanche (M13), inventaire (M17), sondages (M20), discussion interne.

## Première demande à faire à Claude Code

Copier ce message pour démarrer :

> Lis CLAUDE.md puis tous les fichiers de docs/ dans l'ordre. Résume-moi en 10 lignes ce que tu as compris du projet et de ses règles, puis propose-moi le détail du lot 0 avec les étapes que je dois faire moi-même (comptes Supabase et Vercel, clés à coller). Ne commence à coder qu'après ma validation.
