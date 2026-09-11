# Base web locale

Application statique sans dépendances npm, avec un serveur Node.js local.
Le téléchargement du squelette Sites n'a pas abouti dans cette session ; aucun
projet Sites ou service cloud n'a été créé.

Depuis ce dossier : `npm run dev`, puis ouvrir `http://127.0.0.1:4173`.
Le serveur écoute uniquement sur l'interface locale.
`PORT=4174 npm run dev` permet de changer le port si nécessaire.

Depuis la racine, après extraction : `python3 scripts/prepare_web.py` génère
`web/public/game/`. Pillow est nécessaire pour les images. Les ISO et le dossier
`extracted/` ne sont pas servis. Les ressources générées sont ignorées par Git.

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

Les huit décors originaux, les voix, les animations, les 14 simulations et
l'encyclopédie disposent maintenant d'exports dédiés. Les 347 exercices restent
à porter, et la fidélité des séquences, menus, visibilité et animations d'Adi
n'est pas terminée. Voir le [bilan courant](../reports/station-portage.md) pour
les chiffres et limites vérifiés. Les liens multimédias expliquent leur
indisponibilité.
Les petites icônes de lien IMHTML sont remplacées par ↗. Le carnet utilise
localStorage avec repli en mémoire et ne reproduit pas les sauvegardes Windows.

## Décors originaux et voix

Depuis la racine du projet, exécuter `python3 scripts/prepare_scenes.py` après `python3 scripts/prepare_web.py`, puis `python3 scripts/prepare_station.py` et `python3 scripts/prepare_encyclopedia.py`. NumPy, Pillow et FFmpeg sont nécessaires selon les conversions, pas au serveur. La route `#scene/station` ouvre les décors originaux de la station et les bâtiments de biologie. Les ressources ont un manifeste de provenance dans `public/game/scenes/manifest.json` ; les exports station et encyclopédie ont leurs index dans `public/game/station/` et `public/game/encyclopedia/`.

La première activité de la serre est accessible à `#scene/greenhouse`. Générer ses données avec `python3 scripts/prepare_greenhouse.py` puis ses couches avec `python3 scripts/prepare_greenhouse_visuals.py` depuis la racine avant le build. `npm test` vérifie les combinaisons contre les tables extraites. Voir [le bilan courant](../reports/station-portage.md) et [le rapport serre historique](../reports/serre-web.md) pour les limites et captures.
