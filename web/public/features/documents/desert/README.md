# La désertification

La route `#document/s14` utilise [engine.js](engine.js) pour les règles,
[ordonnanceur commun](../environment-atmosphere.js) pour les séquences d’ambiance et [view.js](view.js)
pour configurer le [lecteur commun](../environment-view.js).
Les [ressources](../../../game/documents/desert/) comprennent les images,
animations, textes, bruitages et voix français d’ADI 4.21.

## Interactions et calculs

Les habitations, les poteaux électriques et les puits ouvrent les trois réglages :
population, équipement électrique et irrigation. Le choix sélectionné s’applique
avec « Valider ». Fermer le panneau abandonne la sélection. Les neuf marqueurs
ouvrent les réglages ou les explications des résultats ; ils sont accessibles
au clavier. Les coordonnées suivent le décor original de 640 × 480 pixels.

Les [tables](../../../game/documents/desert/rules.json) décrivent les 45
combinaisons possibles. La consommation de bois dépend de la population et de
l’électricité ; la réserve de bois suit cette consommation. Les besoins agricoles
et le défrichement suivent la population. L’état de la nappe dépend de l’irrigation
et des besoins agricoles ; l’assèchement de la savane suit celui de la nappe.
Ces relations proviennent de `S14.DTA` et de `SIMUL14.TOT`.

« Reconstituer » propose Karankasso Vigué, les nomades du Sahel et Mopti, avec
indices, validation et solution. Le texte du cas de Mopti contient les deux pages
originales. « Comprendre » joue quatre explications animées avec leurs voix ; les
zones du schéma permettent de les rejouer. Le son est activé par défaut. Les explications conservent leur dernière image
jusqu’à la fin de la voix avant de passer à la séquence suivante.

## Animations et composition

Les dépendances définissent l’ordre des séquences. La population, les besoins en
bois, la réserve de bois, le défrichement, la nappe et l’assèchement passent par
les états intermédiaires en utilisant les séquences croissantes ou inverses.
L’électricité, l’irrigation et le marché utilisent des séquences directes.

Les priorités de `MAJSIMU.TOT` ordonnent les calques : l’animation de consommation
de bois passe devant le marché et les arbres du premier plan recouvrent les
séquences d’ambiance. Le bois possède une animation d’équilibre en boucle.

Le rythme d’ambiance suit le compteur du script : 80 unités par tour,
une première attente de 20 000 unités, puis 20 000 à 29 999 unités entre tirages.
Le tirage a lieu après la fin de la séquence active et ne rejoue pas la dernière
sélection. L’exécutable calcule `RAND(n)` par un modulo : `RAND(3)` donne 0, 1 ou 2.
Le script laisse la sélection inchangée pour 0 et choisit `S14_0H` ou `S14_1H`
pour 1 ou 2. `S14_2H` est donc une ressource déclarée mais non sélectionnée.
`S14_RE04` n’est pas appelé : le jeu déclare quatre explications, `RE00` à `RE03`.

## Fidélité et limites

Les panneaux utilisent du texte net et les icônes originales ; les transitions
ne sont pas toutes restituées. La commande web d’arrêt est immédiate.
La cadence des tours dépend du rendu du navigateur. La session ne possède pas
de sauvegarde persistante. Les textes et situations décrivent la période de
l’édition originale. Les [finitions requises](../../../../FIDELITY.md) font partie
des critères d’achèvement.

Les [tests](../../../../tests/desert-document.test.mjs) vérifient les cas,
les 45 combinaisons et toutes leurs transitions, les zones de clic, les tables,
le tirage et la temporisation d’ambiance, les priorités et les médias.
