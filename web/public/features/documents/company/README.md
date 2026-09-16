# L’entreprise

La route `#document/s12` utilise [engine.js](engine.js) pour les règles et
[view.js](view.js) pour configurer le [lecteur commun](../environment-view.js).
Les [ressources](../../../game/documents/company/) contiennent le décor, les
séquences WebP, les voix et les sons du document français ADI 4.21.

## Réglages et résultats

Cinq paramètres se règlent directement dans le décor ou au clavier : la santé
économique, la concurrence et les investissements en production, en publicité
et en recherche et développement. Ils influencent les ventes, la capacité
d’investissement, la clientèle, la consommation et la part de marché.

[rules.json](../../../game/documents/company/rules.json) décrit les valeurs,
les tables de `S12.DTA`, les textes de `SIMUL12.DAT` et les coordonnées et
séquences de `MAJSIMU.TOT`. Les ventes calculées restent distinctes des neuf
niveaux graphiques. La capacité d’investissement utilise les mêmes seuils.
Les trois menus d’investissement consultent à la fois la capacité disponible
et le niveau déjà engagé ; leurs possibilités se recalculent après chaque action.

Les dépendances suivent l’ordre des scripts. Les transitions de recherche
parcourent les états intermédiaires avec les séquences croissantes ou inverses.
Les autres objets rejouent leurs séquences directes. Les animations de repos
complètent les images fixes. La part de marché est représentée avec la concurrence ;
elle est aussi consultable dans « Réglages et résultats ».

## Modes et son

« Reconstituer » propose la crise des années 80, les entreprises en difficulté
et la situation des années 60, avec leurs indices, validation et solution.
« Comprendre » joue les quatre explications animées et leurs voix. Les zones
correspondantes dans le décor permettent de les rejouer. La barre de commandes
apparaît au survol du bas du décor ; « Son » est activé par défaut.

Le document fonctionne sans interpréteur ni archive binaire du jeu. La sortie
arrête les médias, animations et observateurs. Les longues séquences WebP sont
réparties sur plusieurs feuilles, lues sans coupure entre leurs pages.

## Limites

Les panneaux de réglage, de modes et de situations utilisent les images,
la palette originales, avec du texte net rendu par le navigateur. Un choix est appliqué avec le pouce ;
l’aide conserve la sélection en attente. Les présentations respectent les pages
des textes source. Les textes décrivent la période de l’édition originale. La description de la part de marché explicite les dépendances de sa table de calcul.
Les boucles et réactions d’ambiance utilisent les modes et priorités du script
dans l’[ordonnanceur commun](../environment-atmosphere.js). La cadence dépend
du navigateur ; les transitions des fenêtres et du retour aux documents restent
immédiates. Les réglages sont propres à la consultation en cours.

Les [tests](../../../../tests/company-document.test.mjs) couvrent les 900
combinaisons de réglages, les restrictions, les calculs, les séquences et les médias.
