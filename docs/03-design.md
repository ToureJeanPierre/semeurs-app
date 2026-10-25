# Design de l'application

## 1. Identité tirée du logo

Le logo (`assets/logo-semeurs.jpeg`) fixe l'identité : un anneau bleu roi, un ciel bleu traversé de rayons de lumière, un aigle aux ailes déployées, un chandelier à sept branches doré et une Bible ouverte. L'affiche d'évangélisation ajoute un orange chaud et un bordeaux pour les messages forts.

L'application doit être reconnue immédiatement comme celle de l'église : **bleu roi et or**, lumière, élan vers le haut.

### 1.1 Couleurs

| Rôle | Nom | Hex | Usage |
| --- | --- | --- | --- |
| Primaire | Bleu roi | `#1546B8` | En-têtes, boutons principaux, navigation active |
| Primaire foncé | Bleu nuit | `#0B2A6F` | Texte sur fond clair coloré, en-tête du pasteur |
| Ciel | Bleu lumière | `#3BA7F0` | Accents, illustrations, états sélectionnés |
| Or | Or du chandelier | `#E9A90F` | Bouton d'action flottant, distinctions, décor (jamais du texte sur blanc) |
| Chaleur | Orange affiche | `#F08A1C` | Événements, campagnes, mise en avant ponctuelle |
| Fond | Blanc nuage | `#F5F8FD` | Fond général |
| Surface | Blanc | `#FFFFFF` | Cartes |
| Texte | Encre | `#111A2E` | Texte principal |
| Texte secondaire | Ardoise | `#4A5672` | Texte secondaire (contraste ≥ 4,5:1 sur blanc) |

Couleurs d'état des alertes (toujours accompagnées d'un libellé, jamais la couleur seule) :

| État | Anneau | Fond du badge | Texte du badge |
| --- | --- | --- | --- |
| À jour | `#2E9D62` | `#DDF3E6` | `#17633C` |
| Attention | `#E07A12` | `#FDEBD6` | `#8A4204` |
| Urgent / Critique | `#D2342A` | `#FCE3E0` | `#9B1C14` |
| Perdu de vue | `#6B7280` | `#ECEEF2` | `#374151` |

### 1.2 Typographie
- **Outfit** (titres, chiffres) : géométrique et arrondie, en écho aux titres de l'affiche. Graisses 600 et 800.
- **Figtree** (texte courant, interface) : très lisible sur petit écran. Graisses 400, 500, 600, 700.
- Échelle : 12 / 14 / 16 (base) / 20 / 24 / 30 / 40. Interligne 1,45 pour le texte, 1,15 pour les titres.
- Phrases en casse normale ; pas de libellés tout en majuscules.

### 1.3 Formes
- Rayons : 999 px pour les boutons et pastilles, 20–24 px pour les cartes, 28 px pour les feuilles qui montent du bas.
- Ombres très légères teintées de bleu nuit, uniquement sur les éléments flottants (bouton d'action, feuilles, toasts).
- Icônes : trait de 1,8–2 px, coins arrondis (style Lucide). Pas d'émojis dans l'interface.

### 1.4 Motif signature
Les **rayons de lumière** du logo : un léger éventail de rayons blancs à faible opacité, partant du haut, dans l'en-tête bleu de l'accueil et de l'espace fidèle. C'est le seul décor ; le reste reste sobre.

## 2. Élément mémorable : l'anneau de vigilance

Chaque fidèle est représenté par son avatar (photo ou initiales) entouré d'un **anneau** dont la couleur dit son état d'assiduité. À partir du niveau Urgent, l'anneau **émet une onde rouge** qui pulse doucement (le « voyant qui clignote » demandé). C'est l'élément que tout le monde doit reconnaître dans l'appli.

En tête de l'accueil du père de famille, un **baromètre de la famille** : une barre segmentée (rouge, orange, vert) proportionnelle au nombre de fidèles dans chaque état, avec les chiffres en grand.

## 3. Animations (Framer Motion)

Mouvement utile seulement : attirer l'attention ou montrer ce qui a changé.

| Moment | Animation | Durée |
| --- | --- | --- |
| Alerte Urgent / Critique | Onde de l'anneau : échelle 1 → 1,4, opacité 0,9 → 0, en boucle | 1,6 s |
| Ouverture de l'accueil | Remplissage du baromètre de gauche à droite, puis apparition décalée des cartes « à contacter » | 0,9 s puis 60 ms entre cartes |
| Ouverture d'une fiche | Transition partagée : l'avatar de la liste s'agrandit vers l'en-tête de la fiche | 0,35 s |
| Feuille « Noter un contact » | Monte du bas avec ressort, fond qui s'assombrit | 0,35 s |
| Contact enregistré | L'anneau passe au vert en se redessinant, toast de confirmation | 0,6 s |
| Pointage QR réussi | Coche qui se trace + vibration courte du téléphone | 0,4 s |
| « Je suis à la maison » | Ondes radar autour de l'icône pendant la localisation, puis l'épingle tombe sur la carte | 1–3 s |
| Engagement soldé | Jauge qui se remplit, petite pluie de grains dorés (les « semences ») | 1,2 s |
| Changement d'onglet | Indicateur qui glisse sous l'onglet actif | 0,25 s |

Toujours respecter `prefers-reduced-motion` : animations coupées, changements d'état instantanés.

## 4. Navigation

Barre du bas, 5 entrées, adaptée au rôle :
- Père de famille : Accueil, Ma famille, Agenda, Messages, Plus.
- Fidèle : Accueil, Agenda, Mes dons, Prière, Profil.
- Pasteur : Vue d'ensemble, Familles, Agenda, Audiences, Plus.
- Caissier : Caisse, Engagements, Cotisations, Rapports, Plus.

Sur ordinateur : menu latéral à gauche, contenu sur une ou deux colonnes.

Bouton d'action flottant doré selon le contexte : « Pointer le culte », « Nouveau message », « Nouvelle opération ».

## 5. Écrans clés à soigner en priorité

1. **Accueil du père de famille** : salutation, nom de la famille, baromètre, liste « À contacter cette semaine » triée par urgence, onglets Absents / Toute la famille.
2. **Fiche fidèle** : avatar avec anneau, statut d'absence, trois gros boutons (Appeler, WhatsApp, Itinéraire), frise des 8 derniers cultes (pastilles pleines ou vides), carte du domicile, journal de suivi en ligne de temps, bouton « Noter un contact ».
3. **Espace fidèle** : prochain culte avec compte à rebours, QR code de présence, bouton « Je suis à la maison », ma semaine, mes engagements avec jauge.
4. **Message groupé** : choix de la liste, rédaction avec puce `{prénom}` et aperçu personnalisé, choix du canal, programmation.
5. **Pointage** : recherche rapide, liste à cocher par famille, scan QR plein écran, compteur de présents en direct.
6. **Ajouter une équipe** (administration) : nom, couleur, responsables choisis dans la liste, capacités à cocher avec description, aperçu de l'équipe créée.
7. **Vue d'ensemble du pasteur** : présences par culte, alertes par famille, intégrations en cours, finances du mois, engagements, audiences du mercredi.
8. **Caisse** : saisie d'offrande par coupures, double validation, solde par compte.

## 6. Règles d'interface

- Cibles tactiles ≥ 44 px ; texte de base 16 px.
- Contrastes ≥ 4,5:1 ; les états se distinguent aussi par le libellé et la luminosité.
- États vides qui invitent à agir (« Aucun absent cette semaine. Merci pour votre fidélité au suivi. »).
- Messages d'erreur qui disent quoi faire (« Pas de réseau : le pointage est gardé et sera envoyé dès le retour de la connexion. »).
- Montants en FCFA avec espace des milliers (« 60 000 FCFA »), dates en français (« dimanche 26 octobre »).
- Le logo apparaît sur l'écran de connexion, l'icône de l'application installée et les reçus PDF.
