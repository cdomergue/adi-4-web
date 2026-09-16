# Le développement d’un pays

La route `#document/s08` utilise [engine.js](engine.js) pour les règles,
[ordonnanceur commun](../environment-atmosphere.js) pour l’ambiance et [view.js](view.js) pour configurer
le [lecteur commun](../environment-view.js). Les [ressources](../../../game/documents/development/)
comprennent les images, séquences, voix, sons, textes et tables de l’édition
française ADI 4.21. Aucun interpréteur ni archive du CD n’est nécessaire.

## Interactions et calculs

L’arbre, les cultures, le dirigeant, la bourse, l’école et les usines ouvrent
les six réglages : climat, agriculture, stabilité politique, cours agricoles,
éducation et santé, industrie et services. La sélection s’applique avec
« Valider » ; fermer abandonne le choix. Neuf marqueurs accessibles au clavier
ouvrent les réglages ou expliquent les résultats. Le décor conserve les
coordonnées originales de 640 × 480 pixels.

Les [tables](../../../game/documents/development/rules.json) limitent les choix
agricoles selon le climat et réciproquement. Les choix d’éducation et de santé
dépendent de la valeur de l’investissement industriel. Cette valeur suit
l’échelle 0, 2, 5, 8 ; elle est distincte des quatre indices graphiques.
Changer une limite ne réduit pas l’investissement déjà engagé.

Le budget vaut la partie entière de
`stabilité × (agriculture × cours agricoles + industrie) / 6`.
La fécondité vaut `3 − éducation` et l’investissement étranger la partie entière
de `stabilité × industrie / 8`. Ces règles proviennent de `SIMUL08.TOT` et `S08.DTA`.

Le mode Reconstituer propose le Tchad, le Sahel, le Brésil et les nouveaux pays
industriels, avec indices, validation et solution. Les commentaires des situations
se déclenchent lorsqu’une combinaison correspond à un cas en mode Découvrir.
La réussite en mode Reconstituer joue l’animation d’Adi `SGAGNE` ; les
encouragements distinguent moins de 30 % de bons réglages, une réussite partielle
et un seul réglage restant. Les commentaires d’erreur suivent un contrôle sur trois.
« Comprendre » présente six explications animées avec les voix originales ;
les six zones du schéma permettent leur relecture.

## Animations et composition

Les dépendances et priorités suivent `MAJSIMU.TOT`. Le climat, l’agriculture,
l’éducation, l’industrie, la fécondité et l’investissement étranger passent par
les états intermédiaires, avec les séquences inverses lors d’une diminution.
La stabilité, les cours et le budget utilisent des séquences directes.
Les industries et les investissements étrangers ont une animation d’équilibre.

Le compteur d’ambiance avance de 80 unités par tour. Après le premier tirage,
la prochaine échéance est de 20 000 unités, puis de 20 000 à 29 999 unités.
Un tirage attend la fin de la séquence et ne répète pas la dernière sélection.
`RAND(8)` exclut 8 : 0 garde la sélection, 1 et 2 aboutissent à un élément sans
animation aléatoire, 3 à 7 sélectionnent `S08_5H` à `S08_1H`.
Cette branche du script ne sélectionne ni `S08_0H` ni les animations d’équilibre
politiques et scolaires pourtant déclarées en mode aléatoire. Les priorités
placent l’ambiance `S08_5H` derrière les éléments de premier plan.

## Fidélité et limites

Les panneaux de réglage, de modes et de situations utilisent les images,
la palette originales, avec du texte net rendu par le navigateur. Un choix est appliqué avec le pouce ;
l’aide conserve la sélection en attente. Les présentations respectent les pages
des textes source. Les textes décrivent la période de l’édition originale.
Les boucles et réactions d’ambiance utilisent les modes et priorités du script
dans l’[ordonnanceur commun](../environment-atmosphere.js). La cadence dépend
du navigateur ; les transitions des fenêtres et du retour aux documents restent
immédiates. Les réglages sont propres à la consultation en cours.

Les [tests](../../../../tests/development-document.test.mjs) vérifient les quatre
cas, les 4 800 combinaisons, les transitions autorisées, les contraintes, les
zones de clic, l’ambiance, les réactions et la présence des médias.
