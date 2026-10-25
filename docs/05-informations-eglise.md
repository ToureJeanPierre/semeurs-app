# Informations de l'église (données initiales)

Source : affiche d'évangélisation officielle (`assets/reference/affiche-evangelisation.pdf`) et échanges avec Jean-Pierre. Ces données servent au script de seed ; elles restent toutes modifiables dans l'application.

## Identité

| Élément | Valeur |
| --- | --- |
| Nom | Église évangélique Les Semeurs de la Parole |
| Bishop, fondateur | Jehu M. (Londres) |
| Pasteur résident | Michée Gnoléba (Abidjan) |
| Adresse | Yopougon, Camp Militaire, carrefour Gandhi, Abidjan, Côte d'Ivoire |
| E-mail | lessemeursdelaparole@gmail.com |
| Téléphones de contact | 05 06 32 52 43 ; 07 08 31 04 33 ; 07 78 01 66 95 |
| Message d'accueil de l'affiche | « Jésus-Christ t'aime. Nous n'attendons plus que toi. » |
| Logo | `assets/logo-semeurs.jpeg` |

Les titulaires de chaque numéro de téléphone ne sont pas précisés : les enregistrer comme contacts de l'église, que l'administrateur pourra rattacher à des personnes.

## Programme hebdomadaire

| Jour | Horaire | Activité | Type à créer |
| --- | --- | --- | --- |
| Mardi | 18 h – 19 h 30 | Cellule de prières au Camp Militaire, carrefour Niangon | Réunion de cellule (groupe de type Cellule) |
| Mercredi | 14 h – 19 h 30 | Réception avec le pasteur : écoutes, échanges, conseils, orientations, prières, délivrances | Créneaux d'audience (espace pastoral) |
| Vendredi | 18 h – 20 h | Moment de prières et d'enseignements | Culte de semaine récurrent |
| Dimanche | 9 h – 12 h | Culte d'actions de grâces | Culte du dimanche récurrent |

Une seule cellule figure sur l'affiche ; d'autres existent dans différents quartiers et seront créées par l'administrateur.

## À créer au seed

- Types de groupes : Famille, Équipe, Cellule, Jeunesse, Classe d'école du dimanche.
- 5 familles vides nommées « Famille 1 » à « Famille 5 » (renommées ensuite par l'administrateur, qui y affecte les pères de famille).
- Équipes : Chantres et musiciens, Protocole, Évangélisation, Intercession. Groupe Jeunesse (14–50 ans).
- Cellule : Camp Militaire, carrefour Niangon (mardi 18 h – 19 h 30).
- Types de culte : Vendredi (18 h – 20 h), Dimanche (9 h – 12 h), avec postes Modérateur, Prédicateur, Louange, Protocole, Intercession.
- Créneaux d'audience : mercredi 14 h – 19 h 30.
- Rôles système : administrateur, pasteur, assistant pasteur, chargé du programme, père de famille, délégué, responsable d'équipe, responsable de cellule, responsable évangélisation, trésorière, caissier, fidèle.
- Paramètres : seuils 7 / 14 / 21 / 30 jours ; programme de modération 2, 3 ou 6 mois ; jeunesse 14–50 ans ; caissiers 3 ; retards d'engagement non signalés aux pères de famille (option désactivée) ; WhatsApp API et SMS désactivés.
- Modèle de message de bienvenue : « Bonjour {prénom}, merci d'être venu(e) aux Semeurs de la Parole. Jésus-Christ t'aime. Nous serons heureux de te revoir dimanche de 9 h à 12 h, Yopougon Camp Militaire, carrefour Gandhi. »
- Modèle de rappel du culte : « Bonjour {prénom}, rappel : culte d'actions de grâces demain de 9 h à 12 h. Nous comptons sur toi. »
- Comptes de démonstration (données fictives uniquement) : un par rôle principal, pour la phase de test.

Ne jamais créer de vrais fidèles au seed : les membres réels sont saisis par l'église.
