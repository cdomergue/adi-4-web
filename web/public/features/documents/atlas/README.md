# Atlas

[engine.js](engine.js) définit les règles indépendantes du navigateur ;
[view.js](view.js) gère le Canvas, les commandes et les médias HTML.
Les [données](../../../game/documents/atlas/) appartiennent à l’édition française
ADI 4.21 Collège.

Le globe utilise 90 images originales. La vue mondiale mesure 748 × 480 pixels ;
la carte détaillée mesure 2688 × 1728 pixels, avec une fenêtre de 640 × 480.
Le zoom place le point choisi au centre de cette fenêtre, avec une limite
verticale et un raccord horizontal. Les coordonnées des médias sont exprimées
dans la carte détaillée. La vue mondiale affiche les cinq premiers repères de
chaque thème, comme le script original ; la vue détaillée affiche les repères
situés dans sa fenêtre.

Les cinq thèmes possèdent leur fond, leurs calques, leurs libellés et leurs
légendes. Les données des cartes décrivent la géographie présentée dans le jeu,
sans actualisation des chiffres. Les textes des légendes et graphiques sont
dessinés avec les polices originales ; chaque photographie possède sa palette.
Les documents sont des images PNG ou des sons FLAC lus par le navigateur.

Le pointeur, le clavier et le tactile utilisent la même transformation entre les
coordonnées d’écran et celles du décor. La barre flottante se déplace par sa
poignée ou par clic droit. Le planisphère repositionne la vue détaillée. Le son
est activé par défaut ; les présentations ne bloquent pas les commandes.

La session conserve ses réglages pendant la consultation. La navigation, les
calques et la position de la barre ne possèdent pas de sauvegarde persistante.
Comme `TEMP\ADIGEO.INF` dans l’original, le navigateur conserve seulement le
marqueur indiquant que la présentation automatique `N_PR` a déjà été jouée. Elle
se lance lors du premier passage du globe à la carte mondiale et ne bloque pas
les commandes. Les transitions de zoom et l’aide utilisent les commandes web ;
les séquences intermédiaires de l’interpréteur original ne sont pas jouées.
Le contrôle des interactions et de l’intégrité des ressources se trouve dans
[les tests](../../../../tests/atlas.test.mjs).
