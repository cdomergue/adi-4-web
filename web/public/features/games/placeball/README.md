# Place Ball

La route `#game/placebfr` (alias `#game/placeball`) exécute un moteur JavaScript
natif, indépendant du DOM, avec un rendu Canvas de 640 × 440 pixels. Le navigateur
ne charge ni l’exécutable Windows, ni Wine, ni un émulateur.

## Données et règles

Le [catalogue](../../../game/placeball/campaign.json) contient les quinze tableaux
de `PBWIN.UDF`, le fichier ouvert par `PLACEBFR.EXE`. `PLACEBFR.UDF` n’est pas le
fichier de campagne utilisé par cet exécutable. Les identifiants `$PUZZLE`
déterminent l’ordre, indépendamment de leur position dans le fichier. Le plateau
contient 26 colonnes de 16 cases, même si l’en-tête UDF annonce une largeur de 27.
Une case mesure 24 pixels ; l’origine est `(8, 8)`.

Les codes 1 donnent la réserve de sphères propre au niveau, puis deviennent des
cases vides. Le lancement retire une sphère. La boule suit les quatre directions
cardinales ; les collisions sont évaluées lorsque sa position atteint exactement
une case. Le tick natif est de 25 ms ; les cinq vitesses déplacent la boule de
2, 4, 6, 12 ou 24 pixels par tick. Un changement de vitesse attend la prochaine
frontière de case.

- Les murs inversent la direction, sauf les deux directions réfléchies par
  chacune des quatre variantes triangulaires : 5 points.
- Les flippers dévient la boule à angle droit et alternent à chaque passage : 10 points.
- Les hamburgers, bananes et pommes disparaissent : 100 points.
- Un trou disparaît et absorbe la sphère : 250 points.
- Une bombe détruit la sphère et disparaît ; un lanceur détruit la sphère
  mais reste présent. La dissolution dure au minimum 1 400 ms.
- Standard demande tous les trous, Challenge demande aussi tous les prix.
  La réussite vaut 1 000 points, puis le niveau suivant se charge après 400 ms.
  Tous les points sont doublés en Challenge.
- La dernière sphère peut gagner. Sinon l’épuisement remet le score au début
  du niveau et propose un nouvel essai ; les sphères ne se cumulent pas entre niveaux.

Les règles sont dans [engine.js](engine.js), le dessin dans [renderer.js](renderer.js),
les entrées et la présentation dans [view.js](view.js). Le moteur de BeeBop ne
convient pas à ces déplacements de case en case : les deux jeux sont indépendants.

## Présentation et sauvegarde

Les [ressources](../../../game/placeball/artwork.json) identifient six bitmaps et
sept WAV de l’exécutable français. Les masques binaires composent la boule et
la mascotte ; les lanceurs clignotent par XOR avec le sol toutes les 150 ms.
Les bombes alternent leurs deux images à la même cadence. Le panneau inférieur
et ses chiffres utilisent les bitmaps 105 et 107. La mascotte traverse l’écran
après six minutes sans interaction, par pas de huit pixels toutes les 50 ms.
La fin de campagne joue le son 109 pendant l’attente native de 1 500 ms, avant
le classement. Les scores positifs qualifiés proposent une saisie de nom ;
le classement contient dix entrées et peut être effacé après confirmation.

La clé `adi4-placeball-v1` conserve l’enregistrement explicite au début du niveau,
les réglages et les scores. Charger et recommencer restaurent les objets et
la réserve du niveau ; ses points en cours ne sont pas conservés. Le refus du
stockage laisse ces fonctions disponibles en mémoire. Les dialogues suspendent
le moteur ; Échap, la perte de focus et le masquage de l’onglet mettent en pause.
La sortie de route arrête les sons et animations.

## Références et vérifications

L’exécutable de référence a pour SHA-256
`1b322a9ea1fa876d3636c2a3858ac85f2ef5bbf3284c34b458fee3bb66cc65c6`.

| Routines Win16 | Fonction |
| --- | --- |
| `1030:1835`, `1030:1a3f` | Lecture par identifiant, conversion des codes UDF |
| `1028:0292`, `1028:1c75` | Réserve, objectifs et ordre des lanceurs |
| `1028:060f` | Cadence, mouvement et priorité des collisions |
| `1028:0efb`, `1028:1136`, `1028:0d9a`, `1028:12d1` | Trous, murs, flippers, prix |
| `1028:1096`, `1028:101e`, `1028:1a04` | Bombes, lanceurs, dissolution |
| `1008:0576`, `1008:219c` | Fenêtre, transitions et mascotte d’attente |
| `1038:0000…0727`, `1048:0160` | Sons et chiffres |

Les [576 vecteurs](../../../../tests/fixtures/placeball-native.json) proviennent
de l’exécution des instructions x86 originales avec Unicorn. Les seuls appels
neutralisés sont les sons et le dessin Win16 ; les calculs ne sont pas remplacés.
Les [tests](../../../../tests/placeball-engine.test.mjs) comparent les directions,
types de cases, difficultés, alignement et retenues du score 32 bits. Ils vérifient
aussi les quinze tableaux, les réserves, la victoire avec la dernière sphère,
les sauvegardes, les délais et les cinq vitesses.

Les outils [d’extraction](../../../../tooling/extract-placeball.py) et
[d’exécution native](../../../../tooling/placeball-native-fixtures.py) régénèrent
ressources et vecteurs à partir des fichiers originaux fournis séparément.
Pillow et Unicorn ne servent qu’à cette régénération ; le build et les tests
ordinaires demandent seulement Node.js.

`node web/tooling/placeball-preview.mjs` sert les
[scénarios navigateur](../../../../tests/fixtures/placeball-browser.html) sur
`http://127.0.0.1:4183`. Cette origine de test utilise des tableaux synthétiques,
sans modifier le moteur ou les enregistrements du serveur principal.

## Écarts et limites de validation

L’interface utilise des commandes HTML au lieu des menus Windows, un accueil
avec le logo, et une sauvegarde locale au lieu des fichiers `.PBS`. La difficulté
et la vitesse exposent les paramètres du moteur : l’aide d’origine les décrit,
mais les commandes correspondantes ne sont pas reliées aux dialogues dans cette
édition française. Le panneau du mot secret et le dialogue illustré « Très Bon ! »
ne sont pas appelés par son chemin de fin de campagne.

La musique WAVE 110 est absente. Son initialisation WaveMix peut donc désactiver
l’ensemble de l’audio Windows ; le port joue les sept bruitages présents, sans
inventer de musique. La dissolution utilise une permutation reproductible des
pixels, pas le générateur aléatoire Borland. Les blits d’apparition sont composés
dans une seule image navigateur, et non dans l’ordre visible d’un Windows lent.

La comparaison audiovisuelle complète avec une session Windows, la latence
réelle de WaveMix et la distribution aléatoire verticale de la mascotte restent
non validées. Les vecteurs x86 valident les collisions, pas ces éléments de
présentation ; ils ne constituent pas une preuve de fidélité intégrale.
