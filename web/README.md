# ADI 4 Sciences — application web

Application statique en JavaScript, jouable dans un navigateur.
Le serveur Python du client original
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
Les ressources livrées se trouvent dans [public/game](public/game/), les moteurs
ScummVM compilés et leurs licences dans [public/vendor](public/vendor/).
Aucun installateur du jeu, Wine, Python ou outil de compilation supplémentaire
n’est nécessaire pour lancer les jeux inclus.

## Fonctions disponibles

| Entrée | Fonction |
|---|---|
| `#welcome` | Introduction originale et accueil |
| `#room` | Chambre, objets interactifs, déplacements, animations et répliques d’Adi |
| `#documents` | Menu original des dossiers multimédias |
| `#document/animal`, `cycle`, `astro`, `planete`, `espace` | Animaux, cycle de l’eau, ciel étoilé, planètes et conquête spatiale |
| `#document/atlas` | Globe, cartes, calques et documents géographiques |
| `#document/s16`, `s17`, `s12`, `s14`, `s07`, `s08` | Six simulations d’environnement et leurs cas d’étude |
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

Les situations des simulations appliquent les restrictions de choix et les
objets cachés des tables originales. La fourmilière valide des parcours ordonnés ;
les résultats liés à GO attendent son déclenchement. Les séquences distinguent
les transitions croissantes et décroissantes, lisent les voix des observations
et proposent les animations d’équilibre disponibles. « Recommencer » interrompt
la lecture et restaure les états initiaux ; « Vérifier » ne recalcule pas la scène.
Les films de la fourmilière s’ouvrent dans leur cadre de gros plan original,
avec le son intégré, puis laissent place au décor à la fin ou à la fermeture.

Les décors, animations, voix et médias de l’encyclopédie utilisés par le client
sont fournis dans Git. Le [manifeste des ressources](asset-manifest.json) permet
de vérifier leur intégrité après clonage ; le build s’arrête si un fichier
répertorié manque ou a été altéré. Aucune extraction supplémentaire n’est requise.

Les exercices Sciences et les jeux classés « À venir » restent à porter.
Certaines séquences, transitions et interactions restent à vérifier ou compléter.
La synchronisation audiovisuelle et les superpositions complexes ne sont pas
certifiées à l’identique du client Windows. Certains médias référencés par ses
tables ne sont pas disponibles, notamment l’animation « Tolérance greffe » ;
le résultat textuel reste accessible. Les divisions nulles des réglages de
tomates donnent zéro dans le moteur web, sans garantie d’équivalence native
pour ce cas limite.
La planète Internet est une simulation ; elle ne se connecte pas au service TCP
présenté dans [le README du serveur](../serveur/README.md).

## Les documents

Le menu bleu de la chambre présente les douze entrées originales, avec sept
lignes visibles et un défilement à la molette. Les cinq dossiers multimédias regroupent :
24 animaux et leurs films, les six sujets du cycle de l’eau, les cartes du ciel
selon les quatre saisons et les vues Nord/Sud, les 60 rubriques des planètes,
et les neuf dates de la conquête spatiale.

Les clics suivent les masques des décors originaux. Les présentations, films,
voix et ambiances utilisent les médias du jeu. Le son est activé par défaut ;
« Présentation » relance l’introduction et « Arrêter » interrompt la lecture.
La barre du bas apparaît au survol ; son point d’interrogation active ou désactive
l’aide. Une liste de sujets permet aussi l’accès au clavier. Les médias et
métadonnées sont inclus dans [public/game/documents](public/game/documents/).

L’Atlas fonctionne en JavaScript avec les images et coordonnées originales.
Ses cinq cartes couvrent les climats, la densité de population, les langues,
l’agriculture et la pêche, les mines et les énergies. La loupe agrandit la région
cliquée ; le glisser-déposer et les flèches déplacent la carte. Le planisphère
permet de repositionner la vue détaillée. Les boutons flottants ouvrent les
cartes, calques et légendes ; leur poignée déplace la barre. Les graphiques,
photos, alphabets et extraits sonores s’ouvrent depuis les icônes géographiques.
Les légendes et graphiques utilisent les polices originales. La présentation et
les commentaires des thèmes se contrôlent avec « Son » et « Arrêter ».
Les [ressources de l’Atlas](public/game/documents/atlas/) contiennent les médias
utilisés par cette vue ; le navigateur ne charge aucune archive du jeu pour l’Atlas.

[La pollution de l’air](public/features/documents/air/README.md) fonctionne en
JavaScript avec les quatre réglages, les calculs et les séquences animées du jeu.
Les clics dans le décor ouvrent les choix ; « Reconstituer » propose trois cas
avec validation et solution. « Comprendre » donne accès aux explications.
Les voix, bruitages, fumées, nuages et réactions sont inclus dans les
[ressources du document](public/game/documents/air/).

[L’équilibre de la nature](public/features/documents/ecosystem/README.md) fonctionne
en JavaScript avec les réglages de pollution, de chasse, de protection vétérinaire
et d’agriculture. Les populations de lapins et de renards, les herbages, la
végétation et les dégâts aux cultures suivent les calculs du jeu. Les séquences
originales animent chaque étape ; les six explications animées montrent les liens
de l’écosystème dans le mode « Comprendre ». Trois situations proposent des
indices, une validation et une solution.

Les quatre autres simulations portent sur la pollution de l’eau, l’entreprise,
la désertification et le développement d’un pays.
Leurs paramètres se règlent dans les décors, avec les modes et les cas du jeu.
Elles exécutent les scripts du CD avec un
[moteur Gob dédié](public/vendor/documents/README.md).
Le bouton « Ouvrir » autorise la lecture sonore ; « Son » est coché par défaut.
Les commandes du lecteur donnent accès à la barre du bas, à Échap et au plein écran.
Les six simulations sont distinctes des 14 expériences de la station Sciences.
Les sessions des documents ne sont pas sauvegardées entre deux consultations.
Les petits mouvements d’ambiance des décors et certaines transitions ne sont
pas tous reproduits.

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
Un clic de souris dans le jeu capture le pointeur lorsque le navigateur le permet.
Le curseur reste dans le jeu pour faire défiler les décors aux bords gauche et droit.
Échap libère la souris ; un nouveau clic la capture à nouveau. Le bouton
« Capturer la souris » offre le même accès et « Passer · Échap » passe le générique.

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
