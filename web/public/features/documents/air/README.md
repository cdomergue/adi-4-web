# La pollution de l’air

La route `#document/s16` utilise [engine.js](engine.js) pour les règles et
[view.js](view.js) pour configurer le [lecteur commun](../environment-view.js),
son décor Canvas, ses menus HTML et le son. Elle ne charge
ni ScummVM ni les archives du CD.

Les [ressources](../../../game/documents/air/) contiennent les images indexées
et leur palette originale, les séquences VMD converties en planches WebP RGBA,
les voix et bruitages WAV et les tables de données.
[rules.json](../../../game/documents/air/rules.json) décrit les états, les zones
de clic, les textes et les trois cas de reconstitution.

## Règles et interaction

Quatre réglages contrôlent le relief, les industries, la politique énergétique
et la propulsion. Le calcul entier de `SIMUL16.TOT` et les tables de `S16.DTA`
déterminent la brume, la santé des habitants, la végétation et les déchets.
Les valeurs de calcul diffèrent des indices d’images : la plaine vaut 6, la vallée
1, et les dix états de brume correspondent à 1–5 et aux multiples de 6 jusqu’à 30.
La propulsion électrique impose une source d’énergie compatible.

Les clics utilisent les rectangles de `MAJSIMU.TOT`, convertis depuis la taille
affichée vers la scène de 640 × 480 pixels. Les marqueurs et la liste « Réglages
et résultats » donnent aussi accès aux choix au clavier. Les changements animent
les éléments dépendants dans l’ordre du programme, avec les séquences croissantes
et décroissantes originales. Les images d’ambiance conservent la fumée, les
nuages et les réactions des personnages.

« Reconstituer » propose les trois objectifs et vérifie les quatre réglages.
« Comprendre » affiche les explications des éléments. La présentation et les
cas utilisent les voix originales ; « Son » contrôle également l’ambiance et les
bruitages. « Arrêter » interrompt le son et stabilise le décor. La sortie de la
route arrête les médias, les animations et les observateurs.

## Limites

Les panneaux de réglage, de modes et de situations utilisent les images,
la palette originales, avec du texte net rendu par le navigateur. Un choix est appliqué avec le pouce ;
l’aide conserve la sélection en attente. Les présentations respectent les pages
des textes source. Les textes décrivent la période de l’édition originale.
Les boucles et réactions d’ambiance utilisent les modes et priorités du script
dans l’[ordonnanceur commun](../environment-atmosphere.js). La cadence dépend
du navigateur ; les transitions des fenêtres et du retour aux documents restent
immédiates. Les réglages sont propres à la consultation en cours.
