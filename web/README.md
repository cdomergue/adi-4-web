# ADI 4 Sciences — application web

Application statique en JavaScript, jouable sur
[example.invalid](https://example.invalid/). Le serveur Python du client original
n’est pas nécessaire : les sauvegardes et la planète Internet simulée fonctionnent
dans le navigateur.

## Démarrer après clonage

Prérequis : Node.js 22 ou plus récent. Aucune dépendance npm à installer.
Depuis ce dossier :

```sh
npm run dev
```

Ouvrir [l’application locale](http://127.0.0.1:4173/). Le serveur écoute uniquement
sur la boucle locale. Pour utiliser un autre port :

```sh
PORT=4174 npm run dev
```

Les commandes disponibles sont définies dans [package.json](package.json).
Les ressources livrées se trouvent dans [public/game](public/game/), le moteur
ScummVM compilé et ses licences dans [public/vendor/wgob3](public/vendor/wgob3/).
Aucun installateur du jeu, Wine, Python ou outil de compilation supplémentaire
n’est nécessaire pour lancer les jeux inclus.

## Fonctions disponibles

| Entrée | Fonction |
|---|---|
| `#welcome` | Introduction originale et accueil |
| `#room` | Chambre, objets interactifs, déplacements, animations et répliques d’Adi |
| `#radio` | 17 musiques, 10 ambiances et silence |
| `#games` | Caisse, filtre disponibles/à venir et défilement à la molette |
| `#science` | Bibliothèque de cours, niveaux, recherche et dictionnaire |
| `#scene/station` | Décors et accès aux activités Sciences |
| `#simulations` | Catalogue des 14 simulations |
| `#encyclopedia` | Encyclopédie et compléments multimédias |
| `#notebook` | Carnet personnel |
| `#internet` | Correspondants, courrier, calendrier et services simulés |

La chambre, la radio, les jeux et la planète Internet simulée disposent de leurs
ressources dans Git. Les cours comprennent 62 entrées cours/niveau et 554 pages.
Le code des simulations et leurs calculs sont inclus, ainsi que les ressources
de la fabrication des laitages.

Les décors, animations, voix et médias de l’encyclopédie utilisés par le client
sont fournis dans Git. Le [manifeste des ressources](asset-manifest.json) permet
de vérifier leur intégrité après clonage ; le build s’arrête si un fichier
répertorié manque ou a été altéré. Aucune extraction supplémentaire n’est requise.

Les exercices Sciences et les jeux classés « À venir » restent à porter.
Certaines séquences, transitions et interactions restent à vérifier ou compléter.
La planète Internet est une simulation ; elle ne se connecte pas au service TCP
présenté dans [le README du serveur](../serveur/README.md).

## Les dix jeux

| Jeu | Route | Contenu et reprise |
|---|---|---|
| Sokoban | `#game/sokoban` | 15 niveaux originaux |
| Gobliiins | `#game/wgob1` | Édition française Windows des CD ADI ; codes de niveau |
| Gobliins 2 | `#game/wgob2` | Édition française Windows ; sauvegardes du jeu et import/export |
| Goblins 3 | `#game/wgob3` | Édition française Windows ; sauvegardes du jeu et import/export |
| Mr. Matt I | `#game/mrmatt1` | 25 niveaux, annulation, clichés et démonstrations |
| Mr. Matt II | `#game/mrmatt2` | 35 niveaux, moteur partagé avec le premier épisode |
| Bad Toys 3D I à IV | `#game/bt3d_1` à `#game/bt3d_4` | Quatre épisodes, moteur partagé et progression séparée |

Les trois Goblins interprètent les données des CD ADI avec ScummVM 2.9.0 compilé
en WebAssembly. Le lecteur [public/wgob3/player.html](public/wgob3/player.html)
accepte le paramètre `game=wgob1`, `game=wgob2` ou `game=wgob3` ; sans paramètre,
il conserve Goblins 3. Les [licences du moteur](public/vendor/wgob3/COPYING) sont
fournies avec le binaire. Le tableau de bord se trouve en bas dans Gobliiins,
en haut dans les deux suivants.

Mr. Matt propose les sons originaux et une option « Déplacements réfléchis »
désactivée par défaut. Une démonstration originale de Mr. Matt II est incomplète
et n’est pas lancée ; son niveau reste jouable.

Bad Toys conserve les sprites et sons originaux. Plusieurs premiers niveaux sont
communs aux éditions ADI : les épisodes ne diffèrent pas dès la première carte.
La carte se commande avec la touche virgule sur un clavier français. Les crédits
sont accessibles sous les jeux concernés.

## Sauvegardes

Les données sont propres à l’origine du navigateur, donc à l’adresse et au port.
Une partie sur le site publié n’apparaît pas automatiquement sur la version locale.
Les jeux à plusieurs épisodes conservent des sauvegardes séparées.

Goblins 2 et 3 proposent l’export/import pour transférer leurs sauvegardes.
Gobliiins utilise les codes de niveau donnés par le jeu. Le carnet web est
indépendant des sauvegardes du client Windows original. Le stockage peut être
indisponible ou temporaire en navigation privée.

## Vérification et construction

Depuis ce dossier :

```sh
npm run check
npm test
npm run build
npm run preview
```

Le [script de build](build.mjs) génère une distribution statique autonome à partir
des ressources présentes. La prévisualisation utilise le même port par défaut que
le serveur de développement ; arrêter celui-ci ou choisir un autre port.

Les [tests](tests/) couvrent notamment les règles des jeux et simulations,
l’intégrité des ressources livrées, les sauvegardes et les imports de modules.
L’intégrité du contenu livré est vérifiée, mais ces tests ne garantissent pas
que toutes les séquences reproduisent exactement le jeu original.

## Hébergement

La distribution générée peut être servie à la racine d’un hébergement statique.
Aucune base de données, clé API ou service applicatif n’est requis. La navigation
utilise le fragment de l’URL et ne nécessite pas de réécriture des routes.
Un hébergement dans un sous-dossier nécessiterait d’adapter les chemins absolus.

Servir notamment WebAssembly avec `application/wasm`, FLAC avec `audio/flac`
et les modules JavaScript avec un type JavaScript. Le [serveur fourni](server.mjs)
configure ces types pour le développement et la prévisualisation. Les modules et
styles de l’application sont versionnés par le build pour renouveler leur cache ;
un onglet déjà ouvert doit être rechargé après une mise à jour.

Pour modifier le code, voir [l’architecture web](ARCHITECTURE.md).


## Mettre à jour les ressources livrées

Après ajout ou modification de médias, les ajouter à l’index Git puis exécuter :

```sh
node tooling/update-asset-manifest.mjs
npm test
npm run build
```

Le [générateur du manifeste](tooling/update-asset-manifest.mjs) utilise uniquement
les fichiers suivis par Git. Commiter le manifeste avec les ressources modifiées.
Le [contrôle du bundle](tests/bundled-assets.test.mjs) vérifie aussi les références
explicites des catalogues et du code vers les médias du jeu.
