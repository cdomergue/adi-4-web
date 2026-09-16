# BeeBop I

La route `#game/beebop1` utilise uniquement JavaScript natif, Canvas et des
ressources PNG/WAV. Aucun exécutable, émulateur ou moteur tiers n’est chargé
dans le navigateur. Le [catalogue](../../../game/beebop1/campaign.json) contient
les 45 tableaux jouables, leur ordre et les motifs intermédiaires d’origine.
Les 48 dispositions internes ne sont pas 48 tableaux jouables.
Le crédit Stéphane Petit et l’année 1995 figurent dans les bitmaps originaux
67 et 63, respectivement, répertoriés dans le manifeste graphique.

## Règles et provenance

La source est `BEEBOP1.EXE`, exécutable Win16 NE de l’édition ADI, SHA-256
`6246d4e24e9f301c0cb0bba5e8f1e357e227194fde4f210d6a0df063db142ebc`.
Les adresses ci-dessous sont les segments logiques de la décompilation Ghidra,
pas des adresses du fichier ni des adresses virtuelles Win32.

- [engine.js](engine.js) : échantillonnage des quatre coins et priorité des
  briques (`1008:1645`), sept zones de raquette (`1008:0fa8`, `24dd`), bornes
  (`1000:26ba`), lancement (`1008:8925`) et échappement après 1 000 tours.
- [effects.js](effects.js) : laser simple, missile, bonus de vie, alternance
  BIP/BOP et ennemi. Une brique de vie et une brique laser touchées ensemble
  rapportent deux points, mais seule la première disparaît, comme dans le natif.
- [level-rules.js](level-rules.js) : transitions (`1008:9232..ab8d`) et hauteur
  de raquette (`1000:1cfd..1ffb`), comparaisons Pascal exactes, ouvertures de
  passages, drapeaux persistants et désactivation de bonus.
- [renderer.js](renderer.js) : coordonnées originales 510 × 360, terrain
  de 16 × 10 cases de 30 pixels, images et masques exportés, étoiles et
  destructions. Les compteurs HTML restent nets à toute taille.
- [view.js](view.js) : pointeur, clavier, son, pause, plein écran et reprise.
  `sceneleave` interrompt animations, médias et écouteurs. L’apparition du
  tableau suit la permutation `(13*(k+1)-1)%160`. La perte de balle emploie
  les trois icônes 1000, 1001 et 1002 à sa position précédente.
- [presentation.js](presentation.js) : menu de 551 × 363 pixels, trajectoire
  de démonstration (`1008:ac95/acf7`), vitesse (`1008:ae13/b1f3`), bonus
  (`1008:0d15`) et classement de dix noms (`1010:12b0/17ab/02c0`).
  Les égalités passent après les scores existants. Le format Windows réserve
  21 caractères par ligne : quatre chiffres écrasent le dix-huitième caractère
  du nom, dont seuls les dix-sept premiers sont affichés.

Les couleurs `1`, `3`, `4` deviennent une brique à un impact ; `A..O` sont
solides et `P..W` passent par `Z`, `Y`, `1`, puis `0`. Les obstacles `5`
sont mortels. Une brique détruite vaut un point et chaque balle de réserve
rapporte dix points en fin de tableau. La réserve commence à huit ; le premier
service est gratuit, puis la neuvième perte termine la partie à −1.

Les [ressources graphiques et sonores](../../../game/beebop1/artwork.json)
conservent les identifiants NE et les empreintes sources. Les WAV sont en PCM
Windows ; les préambules Macintosh présents dans certains exports ne sont
pas des échantillons audio. Aucun accès aux CD ni extraction locale n’est
nécessaire pour jouer.

## Vérification

Les [vecteurs de référence](../../../../tests/fixtures/beebop1-native.json)
contiennent 722 résultats issus de l’exécution des octets x86-16 originaux
avec Unicorn 2.1.4 : 398 collisions, 180 rebonds et 144 cas de bornes.
Ils proviennent d’un corpus de 7 703 cas, graine `0xbeeb0001`. Le manifeste
de preuve contient les empreintes du binaire, des segments, des relocalisations,
les routines exécutées et les appels graphiques/sonores neutralisés.
Le calcul attendu ne provient pas du moteur JavaScript.

Les [tests différentiels](../../../../tests/beebop-engine.test.mjs),
[tests des effets](../../../../tests/beebop-effects.test.mjs),
[tests des tableaux](../../../../tests/beebop-level-rules.test.mjs) et
[tests de campagne](../../../../tests/beebop-campaign.test.mjs) et
[tests de présentation](../../../../tests/beebop-presentation.test.mjs) couvrent ces
résultats, les règles particulières, les ressources et le cycle des parties.
Ils ne constituent pas une preuve de fidélité audiovisuelle complète.

`node web/tooling/beebop-preview.mjs` sert une
[page de scénarios](../../../../tests/fixtures/beebop-browser.html) à
`http://127.0.0.1:4181`. Elle utilise la vue de production avec des briques de
test permettant de déclencher une défaite, un enchaînement et la victoire finale.
Son origine distincte isole les sauvegardes de l’application. Le serveur et la
page de test ne font pas partie de la distribution statique.

## Moteur commun avec BeeBop II

L’exécutable de BeeBop II est également décompilé ; son empreinte figure dans
le [catalogue des jeux](../../../game/games/catalog.json). Les deux éditions
partagent une famille d’algorithmes, mais ne sont pas interchangeables.

| Règle | BeeBop I | BeeBop II |
| --- | --- | --- |
| Grille | 16 × 10 | 19 × 13 |
| Parcours | 45 tableaux | 20 étapes par chemin de sélection |
| Réserve initiale | 8 | 6 |
| Briques renforcées | `Z → Y → 1 → 0` | `A → B → C → 1 → 0` |
| Armes | Laser simple (`7`) | Simple (`M`), double (`0xD7`), annulation (`S`) |
| Balles actives | Une | Multiballe |
| Missile et balle | Inverse la descente | Inverse la montée |
| Score affiché | Un point par brique | Dix points par brique |
| Échappement de trajectoire | 1 000 tours | Seuil variable, initialement 300 |

Le chargement, la boucle temporelle, les entrées, le stockage, les blits et les
fonctions de grille peuvent former un socle commun, avec dimensions et profils
de règles injectés. Les transitions de tableaux, armes, multiballe et collisions
restent des stratégies propres à chaque épisode. Le moteur livré est celui de
BeeBop I, pas un moteur de BeeBop II déguisé en simple changement de données.
Le portage de II n’est pas activé. Neuf sons PCM sont identiques entre les deux
épisodes ; les icônes ne sont pas interchangeables pixel pour pixel.

## Reprise et limites de fidélité

`adi4-beebop1-v1` mémorise un point de reprise au début du tableau, son score,
ses vies et ses drapeaux, ainsi que le record et l’option sonore. Recommencer
restaure ce point ; sélectionner un tableau démarre avec huit réserves et zéro
point. Ce format n’importe pas les sauvegardes Windows. Les commandes tactiles,
le sélecteur de tableau et le plein écran appartiennent à l’interface web.

Le menu utilise les images et positions d’origine, la balle animée, les boutons
Son, Go, Quitter et R.A.Z. ; Go commence une nouvelle partie. Le classement et
la vitesse sont mémorisés dans la même clé de stockage. Les tableaux
s’enchaînent après le comptage du bonus. La neuvième perte affiche FIN sur fond
orange avec ORGUE ; la fin du 45e tableau utilise FINMEU, les balayages cyan,
blanc et bleu, puis attend un clic. Le dialogue « TAPES TON NOM » conserve le
libellé français de la ressource `DIALOG_4F` avec des contrôles HTML accessibles.
Le retour au menu remplace la fermeture du processus Windows.

La vitesse 36 correspond à 94 tours par seconde. Chaque cran de deux unités
modifie l’attente calibrée d’un tiers sous 36, d’un dixième au-dessus. Le coût
d’un tour est mesuré sur un Canvas hors écran ; un court échantillonnage des
lectures d’horloge fournit le compteur de boucle. Les quotients entiers et
l’arrondi particulier du cran rapide suivent la routine x86 originale, avec
trois cas de calibration vérifiés par exécution native. La limite haute dépend
de ces compteurs (habituellement 54 ou 56, plafond natif de 80). La boucle active
DOS/Win16 n’est pas exécutée pendant le jeu.
Les sons synchrones pilotent le temps de présentation via leur position de
lecture, sans bloquer le navigateur ; en mode muet, leur attente vaut 500 ms.
L’entrée utilise 10 ms par case et la perte 1/6 s par image, selon les diviseurs
200 et 60 des routines d’attente. Les explosions en cours se terminent sans
attente supplémentaire avant le bonus ou l’animation de perte, comme la boucle
native sans temporisation. L’attribution du bonus est immédiate dans le
moteur et son affichage progresse d’un point toutes les 10 ms.

Le jeu original sous Wine permet l’accès au menu et le lancement par Go ; le
pointeur est visible après application d’un curseur X11 à sa fenêtre. Une capture
du premier tableau en cours de partie montre un score de 0002 et huit réserves.
Cette référence fixe ne valide ni les sons ni le rythme du jeu. La comparaison
audiovisuelle complète des parties et des fins reste non validée.
Les délais sont déduits des appels décompilés,
pas mesurés pendant une partie Windows. Le rafraîchissement du navigateur
regroupe les blits et les interruptions de sons courts entre deux images ; il
ne garantit pas la cadence des appels GDI et SndPlaySound d’une machine Win16.
