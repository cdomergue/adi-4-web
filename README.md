# Adi 4 Sciences — portage web personnel

## Jouer après un clone

Avec **Node.js 22 ou plus récent**, depuis la racine :

```bash
npm --prefix web run dev
```

Ouvrir **<http://127.0.0.1:4173/#game/wgob3>** pour Goblins 3 (WGOB3).
La chambre, la ludothèque et Sokoban sont aussi inclus. Le moteur WebAssembly,
les données du jeu et les licences sont suivis dans Git : aucun téléchargement
supplémentaire, `npm install`, setup, extraction ou compilation n’est nécessaire.

`npm --prefix web test` vérifie notamment l’intégrité de la distribution WGOB3.
`npm --prefix web run build` prépare les fichiers statiques dans `web/dist/`.
Les médias Sciences restent locaux et doivent être extraits séparément ; cette
livraison rend WGOB3 jouable après clone, pas toute la station Sciences.
Voir [l’analyse Ghidra et le portage WGOB3](reports/wgob3-portage.md).

## Historique de l’extraction Sciences

Le setup et ses quatre CD ont été extraits sous Linux sans exécuter le jeu.
Les archives Coktel et les bases pédagogiques sont exportées. Une première base
web locale permet de consulter les cours, leurs compléments et le dictionnaire,
avec un carnet personnel. La chambre interactive et le jeu complet restent à porter.
Voir le [bilan courant du portage](reports/station-portage.md) pour l'état vérifié des simulations, médias, encyclopédie et limites restantes.

Lancer la base : `cd web` puis `npm run dev`, et ouvrir `http://127.0.0.1:4173`.
Voir [la documentation web](web/README.md) pour la préparation et le déploiement futur.

Lire [le diagnostic et la proposition technique](reports/diagnostic.md).

Le setup, les disques extraits et les médias Sciences restent locaux et ignorés
par Git. Les ressources nécessaires à WGOB3 et à son accès depuis la chambre
sont incluses dans le dépôt.

## Reproduire

Prérequis : Python 3, 7z, et innoextract 1.9 Linux dans
`tools/vendor/innoextract-1.9-linux/`. L'outil utilisé vient du
[site officiel](https://constexpr.org/innoextract/), archive
`https://constexpr.org/innoextract/files/innoextract-1.9-linux.tar.xz`.
Le setup doit être à la racine. Prévoir environ 10 Go disponibles.

```bash
python3 scripts/extract_setup.py
python3 scripts/extract_archives.py
python3 scripts/export_tables.py
python3 -m unittest discover -s scripts -p 'test_*.py' -v
```

Les scripts réécrivent leurs sorties dédiées lorsqu'ils sont relancés.
Ils ne modifient pas le setup. L'extraction des archives s'arrête sur une
entrée invalide ou une compression inconnue, plutôt que d'annoncer un succès partiel.

## Arborescence

- `extracted/installer/` : contenu Inno Setup, dont quatre ISO.
- `extracted/discs/` : fichiers des quatre CD.
- `extracted/resources/` : ressources décompressées, séparées par CD et archive.
- `extracted/tables/` : exports JSON des tables des deux CD Sciences.
- `extracted/previews/science-menu.png` : fond de menu original converti et vérifié visuellement.
- `reports/resources.jsonl` : provenance, position, taille, compression et SHA-256 de chaque ressource.
- `reports/files.json` : inventaire et empreintes des fichiers du setup et des CD.
- `reports/*-summary.json` : statistiques générées.

Le parseur dBASE conserve les valeurs numériques et logiques sous forme textuelle,
les numéros de lignes, les marqueurs de suppression et les références des mémos.
Les identifiants et relations restent ainsi disponibles pour la reconstruction.
Les textes des tables sont décodés en CP850 ; les HTML et autres fichiers restent
dans leur encodage original.

## Exploration du jeu original

Le [compte rendu détaillé avec captures](reports/exploration-original.md) décrit le profil, la chambre, les jeux, la station Sciences, une simulation et le lecteur de cours, ainsi que les résultats Ghidra et les limites encore ouvertes.

## Décors, simulations et voix dans le navigateur

La [station locale](http://127.0.0.1:4173/#scene/station) relie huit décors originaux et les cours ; le fond de serre est exporté séparément pour les simulations. Préparer les médias avec `python3 scripts/prepare_scenes.py` après `prepare_web.py`, puis `python3 scripts/prepare_station.py` et `python3 scripts/prepare_encyclopedia.py`. Voir le [bilan courant du portage](reports/station-portage.md) ; le [rapport moteur, décodeurs et portage](reports/moteur-et-portage.md) conserve l'état historique de sa session.
