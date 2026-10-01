# Chambre et gros plans

Les zones de clic de [interactions.js](interactions.js) suivent `EDIINTRO:51f2`
et `LIBAPPEL:132f/135e`. Le globe a priorité sur le mobile qui l’entoure.
L’ours, le globe, le mobile, le télescope, la fusée et la fenêtre ouvrent les
gros plans puis leurs documents. La malle ouvre les simulations, la commode
les bons points et le néon « Mes résultats ».

[closeups.js](closeups.js) coordonne les présentations et
[closeup-player.js](closeup-player.js) interrompt les images, sons, chargements
et transitions à la sortie. « Écouter Adi » rejoue une réplique ; « Ouvrir le
document » passe directement à la transition. La radio et la caisse utilisent
le même lecteur pour leurs voix, puis reprennent leurs gestes d’attente.

## Ressources originales

Le [catalogue](../../game/room/closeups/catalog.json) contient les fichiers,
dimensions, placements, durées et empreintes des sources VMD. Les voix viennent
d’`ADIBLA.ITK`, les gestes et transitions d’`ADIANI.ITK`, les poses de
`ENVIR.STK/EDIINTRO.EXT`.
Les corps et les bouches sont composés en WebP animés ; le son est en FLAC.

`DOC:01e5/0321`, `IMAGE:0080` et `LIBADI:967e` déterminent les placements
et familles de répliques. Les animaux et l’astronomie utilisent la posture D,
le cycle de l’eau la posture A. L’Atlas, les planètes et la conquête spatiale
utilisent la voix hors champ prévue par ces scripts. `CTRALIVR`, `CTRASTRO`
et `CCYCLE` précèdent l’ouverture des documents concernés.
Adi est retiré avant ces transitions, y compris hors du rectangle du film,
comme le prévoit la commande 18 de `LIBADI` appelée par `DOC`.

La malle utilise les six lignes d’environnement de `MENUEVCO.PFR` : pollution
de l’air, pollution de l’eau, entreprise, désertification, équilibre de la
nature, développement d’un pays. Les 39 premières images de `CMENUMAL`
ouvrent le panneau sans ascenseur inutile ; `CMENUMA2` ferme les six choix.
Les répliques `AIMAL[A-C]D` suivent le tirage à trois possibilités de `LIBADI`.
Les bons points utilisent `BONSINA` et `CBONPOIN`. Le panneau des résultats
vient de la ressource interne 0 de `LIBADI.TOT`.

## Limites de fidélité

- Les outils et le robot de la chambre restent à recréer. Le fauteuil ouvre
  directement Sciences, sans le sélecteur original de matières.
- Les résultats affichent les catégories originales vides. Les exercices
  notés et les classes virtuelles ne sont pas disponibles ; la commode ne
  produit pas de récompenses fictives.
- La malle propose les six simulations sans filtrage par classe.
- La posture des gros plans est fixe. L’alternative A du télescope selon la
  posture précédente et la continuité d’état avec la chambre restent à porter.
- Les gestes d’attente utilisent les séquences originales avec un délai de
  deux à six secondes. Leur distribution et leurs conditions natives restent
  à comparer. Une réplique ne se répète pas immédiatement.
- La synchronisation WebP/FLAC, les volumes, les transitions interrompues
  et les superpositions restent à comparer intégralement au client Windows.
  Les nouveaux gros plans proposent des commandes navigateur ; leur barre
  native au survol reste à reproduire.
