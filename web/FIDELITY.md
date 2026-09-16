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
