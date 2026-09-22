# BeeBop II

`#game/beebop2` exécute JavaScript natif et Canvas, sans émulateur. Le
[catalogue](../../../game/beebop2/campaign.json) contient les deux parcours de
vingt tableaux accessibles dans l’exécutable ADI, soit quarante dispositions
distinctes de 19 × 13 cases. Les identifiants internes ne sont pas les numéros
affichés. Les ressources sont celles de Stéphane Petit.

## Règles et provenance

La source est `BEEBOP2.EXE`, Win16 NE, SHA-256
`948ed1705fc585a7f9583619ffe34365f657207c7de1827c17c4b9471ff737ad`.
Les adresses désignent les segments logiques Ghidra.

- [engine.js](engine.js) reproduit les trois sous-pas (`1008:0069`),
  le lancement, six réserves et l’échappement après 300 tours. Le pointeur
  commande le bord gauche de la raquette, comme `GetCursorPos` dans l’original.
- [collisions.js](collisions.js) et [paddle.js](paddle.js) reproduisent
  `1008:351f` et `1010:219d`, avec priorités des quatre coins, six motifs
  de mouvement et seuils entiers du rebond. Les briques renforcées suivent
  `A → B → C → 1 → 0`. Une destruction vaut dix points.
- [missiles.js](missiles.js) reproduit `1020:1143/169f` : tirs simple `M`,
  double `0xD7`, annulation `S`, salves à quinze pixels par sous-pas.
  Les projectiles ne ramassent pas les bonus et peuvent redresser une balle
  descendante. La sonde originale n’a pas de borne inférieure en hauteur.
- [level-rules.js](level-rules.js) et les
  [transitions générées](generated/level-transitions.js) reproduisent
  `1008:0178/0289/0472/1ba5`, comparaisons Pascal, passages, limites de raquette
  et lignes mortelles. Les rectangles de passage modifient aussi le plateau cible.
- [death-lines.js](death-lines.js) reproduit les flashes, la destruction et
  la propagation des rayons (`1010:0d96`, `1020:003a..0b5e`).
- [renderer.js](renderer.js) garde les coordonnées 640 × 480 et les identifiants
  des images. Les [séquences](../../../game/beebop2/presentation.json) capturent
  les effacements au clic sur Go (`1000:16d7`), les blits du menu (`1000:19b2`),
  de l’effet central (`1028:0230`), des entrées
  et sorties (`1010:192b/1d91`) et de la défaite (`1028:01a8`).
- [presentation.js](presentation.js) compte cent points par réserve, dix points
  toutes les 10 ms, avec les sons synchrones et leurs attentes de 250 ms.

Le [socle commun](../beebop-common/README.md) est partagé avec BeeBop I.
Les règles de II ne sont pas une variante de données du moteur de I. Le code
multiballe et raquette verticale du binaire appartient à des tableaux internes
inaccessibles depuis les deux parcours ; aucun bonus multiballe n’est inventé.

## Vérification et extraction

Les [tests du moteur](../../../../tests/beebop2-engine.test.mjs) comparent
18 436 résultats issus des octets x86 originaux : 972 collisions de briques,
1 782 rebonds, 400 collisions de missiles, 114 transitions, 13 376 sondes de
lignes mortelles, 192 trajectoires de trois sous-pas et 1 600 étapes de salves.
Les calculs attendus
ne proviennent pas du moteur JavaScript. Les
[tests de présentation](../../../../tests/beebop2-presentation.test.mjs)
comparent aussi 274 séquences de perte, leurs coordonnées et leurs attentes.

Les outils de développement utilisent Python, Pillow, ffmpeg et Unicorn 2.1.4.
L’exécutable n’est pas distribué et n’est pas nécessaire pour jouer.

```sh
python3 web/tooling/extract-beebop2.py BEEBOP2.EXE web/public/game/beebop2
python3 web/tooling/extract-beebop2-campaign.py BEEBOP2.EXE web/public/game/beebop2/campaign.json
python3 web/tooling/beebop2-native-fixtures.py BEEBOP2.EXE web/tests/fixtures/beebop2-native.json
python3 web/tooling/beebop2-rule-fixtures.py BEEBOP2.EXE web/public/game/beebop2/campaign.json web/tests/fixtures/beebop2-rules.json
python3 web/tooling/beebop2-motion-fixtures.py BEEBOP2.EXE web/public/game/beebop2/campaign.json web/tests/fixtures/beebop2-motion.json
python3 web/tooling/beebop2-salvo-fixtures.py BEEBOP2.EXE web/tests/fixtures/beebop2-salvos.json
python3 web/tooling/extract-beebop2-presentation.py BEEBOP2.EXE web/public/game/beebop2/presentation.json web/tests/fixtures/beebop2-presentation.json
```

[port-beebop2-rules.py](../../../../tooling/port-beebop2-rules.py) traduit la
routine `1008:0472` du C décompilé, en conservant les offsets et comparaisons
Pascal. Les autres outils vérifient l’empreinte de l’exécutable source.
`node web/tooling/beebop-preview.mjs --ii` sert les
[scénarios de navigateur](../../../../tests/fixtures/beebop2-browser.html)
sur `http://127.0.0.1:4186`, avec une origine et des sauvegardes réservées aux
tests. Ces scénarios ne font pas partie de la distribution.

## Interface et limites de fidélité

Souris, doigt ou flèches dirigent la raquette. Le relâchement du clic ou d’Espace
lance la balle ; maintenir le bouton tire avec une arme. Échap ou P suspend
le jeu et réaffiche le pointeur. Le menu conserve Go, Quit, vitesse et classement.
Les compteurs et noms sont du texte HTML net, exception approuvée à la fidélité
bitmap. `adi4-beebop2-v1` conserve le début du tableau, le parcours, le score,
les réserves, la vitesse, le son et le classement, sans importer les fichiers Windows.
La pause, le tactile, le plein écran et les sélecteurs sont des adaptations web.
Les parcours sont nommés 1 et 2 : le sens du réglage externe qui sélectionne
`oui`/`non` dans le programme ADI n’est pas établi.

La comparaison audiovisuelle complète avec une partie Windows reste non validée.
Les durées proviennent des routines d’attente et des fichiers audio, pas d’une
mesure sur une machine Win16. Le navigateur regroupe les opérations GDI entre
deux rafraîchissements ; les ellipses de l’effet central utilisent le rasteriseur
Canvas, et les interruptions de sons très courts peuvent différer de Windows.
Ces limites ne constituent pas une validation de fidélité audiovisuelle complète.
