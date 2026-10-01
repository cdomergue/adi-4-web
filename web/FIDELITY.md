# Fidélité au jeu original

La fidélité est le critère d’achèvement du projet. Un écran utilisable ne suffit
pas à considérer sa recréation comme terminée. Les finitions sont obligatoires.
Les choix de réalisation doivent respecter les règles, les interactions, les
images et les sons observés dans le jeu, même lorsqu’ils exigent une analyse
supplémentaire de ses scripts ou de son exécutable.

Les textes des panneaux utilisent une police lissée par le navigateur. Cette
exception de lisibilité conserve les formulations, couleurs, positions et
illustrations originales.

## Vérification attendue

Chaque écran se compare au jeu original : état initial, zones de clic, sélection
et validation, annulation, modes d’aide, résultats et cas proposés. Les transitions
se vérifient dans les deux sens, y compris leurs états intermédiaires. Les sons,
voix, pauses, reprises et fins de lecture se comparent avec les animations.
Les transparences, calques, curseurs, menus au survol, textes et polices font
partie de cette vérification. Les captures et tests doivent permettre de constater
les différences ; les limites connues restent explicites tant qu’elles existent.

## Chambre et gros plans

Les coordonnées de `EDIINTRO` et `LIBAPPEL`, les placements de `IMAGE`/`DOC`,
les répliques de `LIBADI` et les six entrées de `MENUEVCO.PFR` définissent
les interactions. Les voix, bouches, gestes et transitions utilisent les médias
originaux. Le néon ouvre les résultats et la commode les bons points.

Les outils, le robot et les résultats des exercices restent à recréer.
Le choix de posture selon l’état précédent, les temporisations des gestes,
la synchronisation audio/WebP et la barre native dans les nouveaux gros plans
restent à comparer et compléter. La malle expose les six expériences sans
filtrage par classe. Voir la [référence de la chambre](public/features/room/README.md).

## Finitions requises des documents

- Comparer les fenêtres de présentation et leurs transitions intermédiaires.
  Les panneaux de réglage, de modes, de situations et d’aide des simulations
  utilisent les images, la palette originales, avec du texte net rendu par le navigateur.
- Vérifier pour chaque document les temporisations d’ambiance, leurs conditions,
  leur interruption, l’ordre des calques et la synchronisation des sons.
- Vérifier les sélections, validations et annulations de chaque panneau
  par comparaison avec les interactions originales.
- Comparer les mouvements d’ambiance aux séquences originales dans chaque
  saison et chaque direction de l’astronomie, y compris leur interruption.
- Vérifier les limites de session des simulations après retour aux documents.
  L’Atlas mémorise le passage de sa présentation automatique, tandis que ses
  réglages de navigation restent propres à la consultation.

Les comportements propres à chaque document sont décrits dans leurs références :
[pollution de l’air](public/features/documents/air/README.md),
[équilibre de la nature](public/features/documents/ecosystem/README.md),
[entreprise](public/features/documents/company/README.md),
[pollution de l’eau](public/features/documents/water/README.md),
[désertification](public/features/documents/desert/README.md),
[développement d’un pays](public/features/documents/development/README.md).

## Station Sciences

Les zones de clic proviennent des fichiers de niveau des deux disques.
L’arrivée, les neuf documents des laboratoires et les cinémas de Dinosaures,
de l’éclipse et de la fourmilière utilisent les films originaux. Les boucles,
les animations aléatoires des décors et les présentations d’Adi suivent les
scripts `AE_ENVSC`, `AE_ANIM`, `AE_ADI` et `SL_SIMUL`.

La [référence Sciences](public/features/science/README.md) précise les médias
absents des disques, les interventions encore sans déclencheur et les contrôles
audiovisuels requis. Les panneaux des simulations, la synchronisation des WebP
et du son, les volumes relatifs et les transitions interrompues restent à
comparer au client Windows. Une vérification des règles ou du nombre d’images
ne valide pas à elle seule ces détails.

## BeeBop I

Les règles proviennent de la décompilation de l’exécutable Win16. Les collisions,
rebonds de raquette et limites sont comparés à 722 résultats d’exécution x86
native en émulation. Cette vérification ne couvre pas le rendu ni le timing.
Le menu original, le pointeur et le bouton Go fonctionnent dans un environnement
Wine isolé. Une capture du premier tableau en cours de partie confirme l’accès
au jeu, avec un score de 0002 et huit balles de réserve. Elle ne valide pas les
sons, la cadence ni les séquences d’une partie complète.

Le menu animé, le classement, le dialogue de nom, le bonus et les deux fins
suivent les ressources et les appels décompilés. La vitesse centrale vise
94 tours par seconde ; les attentes sonores suivent la lecture réelle des WAV.
La comparaison en partie Windows, le coût réel des opérations graphiques et la cadence
des blits et des sons courts restent non validés. Les [limites détaillées](public/features/games/beebop/README.md)
font partie du travail requis de fidélité, pas d’améliorations optionnelles.

## Place Ball

Les quinze tableaux de `PBWIN.UDF` et les ressources Win16 alimentent le moteur
natif. Les collisions concordent avec 576 résultats d’exécution x86 des routines
originales. Les changements d’orientation, les cinq variantes de murs, les points,
les deux difficultés et les retenues 32 bits font partie de cette comparaison.
La validation audiovisuelle complète dans Windows reste distincte de ces tests.
La musique manquante, la permutation des pixels de dissolution, la distribution
verticale de la mascotte, la composition des blits et l’adaptation des menus et
sauvegardes sont décrites dans la [référence du port](public/features/games/placeball/README.md).
