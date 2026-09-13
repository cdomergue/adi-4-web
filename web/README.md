# Base web locale

Application statique sans dépendances npm, avec un serveur Node.js local.
Pour modifier le code : [architecture, emplacement des modules et validations](ARCHITECTURE.md).
Le téléchargement du squelette Sites n'a pas abouti dans cette session ; aucun
projet Sites ou service cloud n'a été créé.

Depuis ce dossier : `npm run dev`, puis ouvrir `http://127.0.0.1:4173`.
Le serveur écoute uniquement sur l'interface locale.
`PORT=4174 npm run dev` permet de changer le port si nécessaire.

**Après un clone :** Node.js 22 ou plus récent suffit, sans `npm install`.
La chambre, la ludothèque, Sokoban et **WGOB3** disposent de leurs ressources
dans Git. Accès direct : <http://127.0.0.1:4173/#game/wgob3>.
WGOB3 fonctionne aussi seul à <http://127.0.0.1:4173/wgob3/player.html>.
Aucun setup, Wine, Ghidra, Python ou Emscripten n’est nécessaire pour jouer.
Les médias de la station Sciences restent à préparer séparément.

Les ressources générées à partir des installations originales restent hors du
dépôt public. Les ressources déjà portées dans `web/public/game/` sont servies
directement après un clone.

Validation : `npm run check` puis `npm run build`.
Prévisualisation du build : `npm run preview`.

`dist/` est une version autonome à déposer à la racine d'un hébergement statique.
Il n'y a ni base de données, ni clé API, ni service externe. La navigation utilise
le fragment URL, sans configuration de renvoi des routes. Une publication dans
un sous-dossier nécessitera d'ajuster les chemins absolus des assets.

Cette version 0.1 propose un accueil provisoire avec les images d'installation,
62 entrées cours/niveau, 554 pages des deux éditions, 431 définitions, des filtres,
les liens entre compléments et un carnet local. Les ressources sont adaptées à
la lecture, sans reproduire encore l'interface interactive originale.

Les huit décors originaux, les voix, les animations, les simulations et
l’encyclopédie disposent d’exports dédiés. Les 347 exercices restent à porter,
et la fidélité de plusieurs séquences, menus, zones et animations d’Adi reste
à vérifier. Les liens multimédias expliquent leur indisponibilité.
Les petites icônes de lien IMHTML sont remplacées par ↗. Le carnet utilise
localStorage avec repli en mémoire et ne reproduit pas les sauvegardes Windows.

## Décors originaux et voix

La route `#scene/station` ouvre les décors de la station et les bâtiments de
biologie. Les exports disponibles sont indexés dans `public/game/station/` et
`public/game/encyclopedia/`. Les outils de préparation restent dans le dossier
personnel et ne sont pas nécessaires pour utiliser les ressources livrées.

La première activité de la serre est accessible à `#scene/greenhouse`. Les
données incluses sont vérifiées par `npm test` ; les outils de génération et les
tables d’origine restent dans le dossier personnel.

## Chambre et premier jeu Win16

`#room` ouvre la chambre avec son décor natif. La caisse mène à `#games` et à la
ludothèque. Sokoban, WGOB1, WGOB2, WGOB3, Mr. Matt I et II et les quatre jeux
Bad Toys 3D sont disponibles ; les autres jeux restent à porter.

La radio de la chambre mène à `#radio` : 17 musiques et 10 ambiances originales, plus le choix du silence. Les sons sont extraits sans perte en FLAC et téléchargés à la sélection. Adi joue neuf séquences d’attente dans la chambre et la caisse, et cinq dans la radio, avec les transitions de posture originales. Dans la chambre, les gestes sont suspendus pendant les animations au clic et les gros plans, puis reprennent au retour. La préférence système de réduction des animations est respectée.

Les ressources de ces menus sont livrées dans `public/game/room/activities/` pour
fonctionner après clone. Le serveur statique doit servir `.flac` avec
`audio/flac`.

## Goblins 3 / WGOB3

`#game/wgob3` lance l’édition française Windows fournie avec ADI, dans le moteur
Gob de ScummVM 2.9.0 compilé en WebAssembly. L’analyse Ghidra, les versions de
compilation et les limites sont documentées dans les fichiers de travail privés.
Le moteur compilé, ses licences et les données sont inclus dans Git : le jeu
est jouable dès le clone. Pour **recompiler volontairement** le moteur, installer
les sources et le SDK épinglés. La recompilation du moteur n’est pas requise pour
utiliser la version WebAssembly livrée.
Les extractions d’origine sont nécessaires uniquement pour régénérer les données.
Le déploiement statique doit servir `.wasm` avec `application/wasm`.
Les sauvegardes sont propres à l’origine du navigateur (adresse et port) ;
l’export/import permet de les transférer lors d’un futur déploiement.

## Mr. Matt I / MRMATT1

`#game/mrmatt1` ouvre les 25 niveaux des cinq jeux MAT du disque. Moteur
JavaScript recréé depuis l’analyse Ghidra, quatre décors et sons originaux.
Flèches, clic sur une case alignée et boutons tactiles ; annulation, clichés,
démonstrations SOX et sauvegarde automatique dans le navigateur. Les ressources
de `public/game/mrmatt1/` sont incluses dans la distribution, sans Python ni Wine
pour jouer. `npm test` rejoue les 25 solutions originales et vérifie les fichiers.
La version jouable est livrée dans `public/game/mrmatt1/` ; aucune régénération
n’est nécessaire pour lancer le jeu. Les tests web s’exécutent sans les sources
d’extraction originales.
