# Outils ADI

Les trois outils intégrés de `MENUEVCO.PFR` sont accessibles au bureau,
par la barre de la chambre, de la caisse, de la radio et des documents.
Les moteurs utilisent uniquement JavaScript et les API du navigateur.

## Bureau et ressources

Le décor est `IMAGE.EXT` 30005. Les zones de clic et la posture D décalée de
(273, −25) suivent `OUT.TOT`. Les présentations `AIOUT[A-F]D`,
`STCAL[A-E]D`, `STBLO[A-E]D` et `STDES[A-E]D` compositent les bouches sur
le corps original. Les gestes d’attente viennent du catalogue de la chambre.
« Ouvrir maintenant » permet de passer la réplique. La sortie coupe tous les
médias et annule les ouvertures différées.

Le [catalogue](../../game/tools/catalog.json) identifie les sources EXT et leurs
empreintes SHA-256. Les images RGB555 et les images indexées utilisent les
palettes internes d’`INTROPAL.TOT` et `ADI4_B2.TOT`. Le noir de détourage est
transparent pour les vignettes. Les ressources nécessaires sont incluses dans
[game/tools](../../game/tools/) ; aucune extraction n’est nécessaire au lancement.

## Calculatrice

L’habillage scientifique est la ressource 30001 d’`ADI4_CAL.EXT`. Les touches
suivent `ADI4_CAL.TOT` ; la poignée supérieure déplace le boîtier.

- Saisie de dix chiffres, séparateur décimal, signe et exposant signé.
- Calcul immédiat des opérations successives ; pile de dix parenthèses.
- Carré, racine, inverse, sinus, cosinus, tangente et leurs inverses.
- Le clavier accepte chiffres, opérateurs, parenthèses, `E`, Retour arrière,
  Entrée et Échap. `C` efface ; `OFF` revient au bureau.

L’external 457 du moteur Windows (`ADI4.EXE`, fonction de dispatch à
`004020f6`, appels trigonométriques autour de `00403695`) travaille en radians.
Sa restriction d’arc sinus et arc cosinus à [0, 1] est reproduite. Les erreurs
arithmétiques ne produisent pas de valeur infinie ou de code évalué.
La présentation sonore provient de `CALCUL0.VMD`.

## Bloc-notes

Le décor, les quatre papiers et les deux boutons de collection proviennent
d’`ADI4_B2.EXT`. `ADI4_BN.TOT` délègue à `ADI4_B2.TOT` dans le client original.
La voix d’entrée est `BLOCIN0.VMD`.

Les textes possèdent un titre, jusqu’à 20 chapitres, une encre par chapitre
(noire, bleue, verte ou rouge) et un papier. « Sauver » alimente « Mes textes » ;
« Nouveau texte » conserve le texte précédent avant de créer une page vierge.
L’ouverture, le renommage, l’effacement confirmé, l’impression et l’import/export
RTF sont disponibles. Le RTF importe le texte sans exécuter d’objet ni de HTML.
Un verrou par mot de passe demande la phrase à l’ouverture ; il ne chiffre pas
le contenu du stockage. Un mémo non verrouillé peut apparaître dans la chambre.

Le brouillon et au plus 100 textes de 50 000 caractères par chapitre utilisent
`adi4-tools-notepad-v1`. En cas d’échec de stockage, l’écran signale la nécessité
d’exporter. Ces données ne modifient pas le carnet de cours `adi4-v1`.

## Palette

La feuille mesure 475 × 340 pixels à (102, 30). Les positions des outils et les
48 couleurs suivent `PALETTE.TOT` (tables `0f47` et `13c7`). Les fonds viennent
de `DECOR.EXT` : huit paysages, huit coloriages et six papiers. Les 520 vignettes
sont découpées selon les rectangles de `STICKER.TOT` sur les 30 planches
`STICKER.EXT` 30003 à 30032.

- Crayon, pinceau, gomme, trait fin/gros, lignes, cercles/disques et rectangles.
- Symétrie horizontale et verticale simultanée, comme le commutateur natif 0/3.
- Annulation/rétablissement du dernier dessin, y compris fonds, collages et texte.
- Découpage, couper/coller et copier/coller ; Échap termine le collage.
- Tampons avec les vignettes originales, texte et choix de police et de taille.
- 36 sauvegardes réparties en trois pages, avec confirmation de remplacement.
- Brouillon conservé, import PNG/JPEG/WebP, export PNG et impression navigateur.

Le moteur dessine sans lissage sur un tampon RGBA ; les coordonnées de la souris
et du tactile sont ramenées à la taille originale. IndexedDB
`adi4-tools-paint-v1` conserve les images PNG. Si ce stockage est indisponible,
le dessin courant reste en mémoire et l’export permet de le conserver.
Le point d’interrogation active l’aide parlée des outils (`LVAOU*`).

## Limites de fidélité

- Print Artist est une application externe référencée mais désactivée dans la
  table des outils fournie. Son exécutable et son interface ne sont pas portés.
- Les dialogues de fichiers, galeries, confirmations et contrôles complémentaires
  utilisent des éléments navigateur. Leur disposition diffère des panneaux
  natifs ; les curseurs animés et certaines animations de boutons manquent.
- Le bloc-notes ne reproduit pas le contrôle Windows de texte enrichi : une encre
  s’applique au chapitre entier. Les tableaux, images incorporées et variations
  typographiques des RTF externes ne sont pas conservés. « Mes préférés » et
  « Mes messages » restent vides, sans liaison avec les anciens services réseau.
  Les mécanismes Windows de récupération de mot de passe ne sont pas présents.
- La position et l’apparence du mémo de chambre sont adaptées au navigateur.
- Les polices de la palette sont des polices navigateur. Le tampon de dessin
  reproduit les opérations ; les empreintes exactes des pinceaux, l’arrondi des
  cercles et toutes les combinaisons d’outils ne sont pas certifiés pixel pour pixel.
- L’arrondi et le formatage des très grands/petits nombres de la calculatrice
  peuvent différer du runtime C d’origine. Le modèle élémentaire n’est pas exposé.
- Les voix utilisent les pistes originales. Leurs timings, les gestes aléatoires
  et toutes les transitions restent à comparer intégralement au runtime Windows.
