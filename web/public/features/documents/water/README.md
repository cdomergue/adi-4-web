# La pollution de l’eau

La route `#document/s17` utilise [engine.js](engine.js) pour les calculs et
[view.js](view.js) pour configurer le [lecteur commun](../environment-view.js).
Les [ressources](../../../game/documents/water/) comprennent le décor, les
animations WebP, les sons et les voix de l’édition française ADI 4.21.

## Réglages et calculs

Sept éléments du paysage permettent de modifier les activités urbaines et
industrielles, le traitement de l’eau, la politique écologique, l’agriculture,
l’état des plages et le dégazage des pétroliers. Les résultats sont le stockage
des déchets, les rejets des égouts et la pollution de la mer. Les marqueurs sont
accessibles au clavier ; deux marqueurs du décor ouvrent l’explication sur la mer.

[rules.json](../../../game/documents/water/rules.json) contient les coordonnées,
les textes français, les cas, les valeurs et l’ordre des dépendances des scripts.
Le calcul des déchets divise les activités urbaines et industrielles par le
facteur de politique écologique. Le traitement de l’eau agit sur les rejets.
Sans ville ni industrie et sans épuration, le script conserve un niveau de rejet
de un. Les deux divisions du calcul de pollution marine sont arrondies séparément.

Le résultat marin est plafonné à quatre par `SIMUL17.TOT`, conformément aux cinq
états graphiques disponibles. La valeur avant plafonnement reste dans l’état du
moteur pour la validation des calculs. Les sept réglages sont tous disponibles :
`MAJSIMU.TOT` désactive la restriction d’épuration stockée dans `S17.DTA`.

## Animations et modes

Les changements animent les objets dans l’ordre des dépendances du jeu. Les
séquences croissantes et inverses passent par les étapes intermédiaires ; la
politique écologique et les plages utilisent des séquences directes. Le pétrolier
au premier plan possède son calque fixe. Les animations de repos et six séquences
d’ambiance complètent le décor. Les [transitions communes](../environment-animation.js)
gèrent les frames et les feuilles WebP multiples.

« Reconstituer » propose les trois cas originaux, avec indices, solution et
validation. « Comprendre » présente sept explications animées avec leurs voix ;
les zones du schéma permettent de les rejouer. La barre de commandes apparaît
au survol du bas du décor. Le son est activé par défaut et peut être coupé.

Le document fonctionne sans interpréteur ni archive binaire. Sa fermeture
arrête les sons et les animations et déconnecte les observateurs.

## Limites

Les textes pédagogiques et les situations géographiques décrivent la période
de l’édition originale. Les fenêtres utilisent du texte HTML. La cadence des
animations d’ambiance repose sur une temporisation web. La session ne possède
pas de sauvegarde persistante.

Les [tests](../../../../tests/water-document.test.mjs) couvrent les 972 combinaisons,
les trois cas, les exceptions de calcul, les zones cliquables, les transitions
et l’intégrité des médias.
