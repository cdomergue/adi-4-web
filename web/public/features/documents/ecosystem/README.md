# L’équilibre de la nature

La route `#document/s07` utilise [engine.js](engine.js) pour les règles et
[view.js](view.js) pour configurer le [lecteur commun](../environment-view.js).
Le décor Canvas, les menus, les voix et les animations fonctionnent en JavaScript,
avec les [ressources du document](../../../game/documents/ecosystem/).

## Réglages et populations

Les quatre paramètres sont la pollution, la chasse, la protection vétérinaire
et l’extension des cultures. Ils influencent six résultats : les herbages,
les lapins, les renards, la végétation, les dégâts aux cultures et l’équilibre
entre les deux espèces.

[rules.json](../../../game/documents/ecosystem/rules.json) décrit les valeurs
de `S07.DTA`, les textes de `SIMUL07.DAT`, les rectangles de clic et l’ordre
des dépendances de `MAJSIMU.TOT`. Chaque action effectue une seule passe de
calcul : les lapins dépendent de la population de renards déjà présente, puis
les renards dépendent du nouveau nombre de lapins. Choisir à nouveau un même
réglage peut donc faire évoluer les résultats. La racine carrée utilise les
vingt itérations entières de `SIMUL07.TOT`.

La protection vétérinaire limite les choix proposés pour la chasse. Une
option devenue indisponible reste la valeur courante tant que le joueur
n’en choisit pas une autre, conformément aux tables et au flux du programme.

## Décor et modes

Les clics dans le paysage utilisent les coordonnées originales de 640 × 480,
adaptées à la taille affichée. Les marqueurs accessibles au clavier et la liste
« Réglages et résultats » ouvrent les mêmes choix et explications.

Les changements jouent les séquences originales dans l’ordre des dépendances,
y compris les étapes intermédiaires et les séquences inverses. Les animations
d’ambiance, les voix et les bruitages utilisent les ressources du CD. Les longues
séquences occupent plusieurs feuilles WebP ; le lecteur passe d’une feuille à
l’autre sans interrompre la lecture. L’index de couleur 0 est transparent.

La barre apparaît au survol du bas du décor. « Reconstituer » propose les trois
cas originaux : l’Australie, la nature préservée et l’extinction des espèces.
Les indices, la validation et la solution accompagnent chaque cas. « Comprendre »
joue six explications avec les flèches animées et les voix originales ; les zones
du schéma permettent de les rejouer. « Son » est coché par défaut. « Arrêter »
stabilise le décor et interrompt ses sons.

## Limites

Les panneaux de réglage, de modes et de situations utilisent les images,
la palette originales, avec du texte net rendu par le navigateur. Un choix est appliqué avec le pouce ;
l’aide conserve la sélection en attente. Les présentations respectent les pages
des textes source. Les textes décrivent la période de l’édition originale.
Les boucles et réactions d’ambiance utilisent les modes et priorités du script
dans l’[ordonnanceur commun](../environment-atmosphere.js). La cadence dépend
du navigateur ; les transitions des fenêtres et du retour aux documents restent
immédiates. Les réglages sont propres à la consultation en cours.
