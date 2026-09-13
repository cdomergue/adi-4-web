# État du projet ADI 4

## Principes

Le client web utilise les graphismes, sons, textes et données du jeu original.
Il fonctionne avec les ressources livrées dans Git et peut être hébergé comme
site statique. Le serveur TCP du client Windows constitue un projet distinct.

La fidélité au jeu original guide le portage. Les fonctionnalités prises en charge
et leurs limites sont décrites dans les [README web](web/README.md) et
[serveur](serveur/README.md). L’[architecture](web/ARCHITECTURE.md) décrit les
modules et leurs responsabilités.

## Fonctions disponibles

- Introduction vidéo, chambre interactive, gestes et répliques d’Adi.
- Radio avec 17 musiques et 10 ambiances ; caisse avec filtres et molette.
- Dix jeux : Sokoban, les trois Goblins, Mr. Matt I et II, les quatre Bad Toys 3D.
- Cours, dictionnaire, carnet, encyclopédie illustrée et films.
- Station Sciences et 14 simulations avec leurs règles et médias.
- Planète Internet simulée dans le navigateur.
- Serveur TCP avec comptes, profils, courrier et réservations de classes.

Le [manifeste des ressources](web/asset-manifest.json) et les tests vérifient
l’intégrité du contenu livré. Cette couverture ne signifie pas que le portage
reproduit tous les comportements du jeu original.

## Travail prioritaire

La chambre et la ludothèque sont prioritaires. Les jeux classés « À venir »
sont à porter, y compris ceux qui utilisent des exécutables 16 bits. Une
difficulté d’exécution sur un système moderne ne suffit pas à exclure un jeu.

La station Sciences est à approfondir : exercices interactifs, aide,
transitions, synchronisation des animations et correspondance des zones cliquables.
Les commandes et séquences doivent être comparées aux comportements du jeu original.

## Limites

Certains jeux et exercices ne sont pas pris en charge. La fidélité des animations,
interactions et enchaînements varie selon les activités. Une démonstration de
Mr. Matt II est incomplète ; son niveau reste jouable.

La planète Internet web utilise des services simulés. Le serveur TCP gère une
partie du protocole du client original, mais ne fournit pas les archives nécessaires
aux exercices des classes. Les achats, forums de discussion, présence en ligne et
animation synchronisée d’une classe complète ne sont pas implémentés.
