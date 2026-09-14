# Moteur des documents

Ce répertoire contient le moteur Gob de ScummVM 2.9.0 compilé avec Emscripten
4.0.10 pour l’Atlas et les six simulations d’environnement d’ADI 4.21 français.
Le client charge `scummvm.js` et `scummvm.wasm` sans installation supplémentaire.
Le moteur des jeux Gobliiins se trouve dans [wgob3](../wgob3/) et possède son
propre binaire.

Les [sources adaptées](source/engines/gob/) définissent l’ouverture directe des
scripts des documents, la décompression LZSS étendue, les images RGB555
et leur conversion vers la palette courante, les objets animés VMD,
le canal d’ambiance, les champs numériques et les catalogues de textes sans
images. Elles fournissent aussi les commandes du lecteur web. Les règles des
simulations et les zones interactives restent dans les scripts originaux.

## Compilation

Utiliser les [sources ScummVM 2.9.0](https://github.com/scummvm/scummvm/tree/v2.9.0)
et une installation du SDK Emscripten avec la version 4.0.10 activée.
Le [script de compilation](rebuild.sh) applique les fichiers de ce répertoire
à une copie de travail des sources et construit uniquement le moteur Gob :

```sh
bash web/public/vendor/documents/rebuild.sh /path/to/scummvm-2.9.0 /path/to/emsdk
```

Le script écrit les deux binaires dans ce répertoire. Le manifeste général
[asset-manifest.json](../../../asset-manifest.json) contient leurs empreintes.

## Licences

ScummVM est distribué sous [GPL](../wgob3/COPYING) ; ses
[mentions de copyright](../wgob3/COPYRIGHT) et les
[licences tierces](../wgob3/LICENSES/) accompagnent le moteur.
Cette licence concerne le moteur, pas les données originales ADI.

## Périmètre

Le lecteur utilise les archives du CD incluses dans
[les ressources des documents](../../game/documents/native/).
Il fournit les commandes de son, de retour, de barre du bas et de plein écran.
Les réglages sont conservés pendant la consultation ; il n’existe pas de
sauvegarde persistante des sessions de ces sept documents.
