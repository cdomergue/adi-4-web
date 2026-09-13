# Architecture web

L’application est un site statique utilisant les modules JavaScript natifs du
navigateur. Node.js sert au développement, aux vérifications et à la construction.
Les ressources nécessaires au client sont incluses dans Git ; aucune extraction
ni installation du jeu original n’est requise pour l’exécuter.

Les commandes d’utilisation sont décrites dans le [README web](README.md).

## Initialisation et navigation

[index.html](index.html) définit la structure de la page.
[app.js](public/app.js) charge le catalogue, initialise la bibliothèque de cours
et installe l’interface commune et le routeur.

- [application/router.js](public/application/router.js) associe les fragments
  d’URL aux vues, gère la navigation active et émet `sceneleave` à la sortie
  d’un écran.
- [application/shell.js](public/application/shell.js) gère les dialogues,
  notifications, crédits et le texte « À propos de cette version ».
- [application/welcome.js](public/application/welcome.js) présente l’accueil
  et l’introduction vidéo.
- [shared/text.js](public/shared/text.js) fournit l’échappement HTML et la
  normalisation des recherches.

Les vues possèdent leurs événements et médias. Elles arrêtent les animations,
sons et observateurs lorsque l’utilisateur quitte leur écran. Le routeur délègue
les règles aux modules des fonctionnalités.

## Cours et encyclopédie

[library.js](public/features/courses/library.js) gère les niveaux, filtres,
cours lus, historique de navigation, dictionnaire et carnet.
[links.js](public/features/courses/links.js) interprète les liens `#EMM` des
cours et identifie les définitions et compléments correspondants.
[encyclopedia.js](public/features/courses/encyclopedia.js) recherche et affiche
les textes, illustrations et films.

Le [catalogue principal](public/game/catalog.json) contient les cours, pages
et définitions. L’[index de l’encyclopédie](public/game/encyclopedia/index.json)
relie les entrées à leurs médias. Le stockage du carnet utilise la clé `adi4-v1`
et propose un repli en mémoire lorsque le navigateur refuse le stockage persistant.

## Chambre, radio et caisse

[room.js](public/features/room/room.js) coordonne les objets cliquables,
gros plans et commandes de la chambre. [games.js](public/features/room/games.js)
ouvre la caisse ; [activities.js](public/features/room/activities.js) affiche les
menus de la caisse et de la radio, leur pagination, leurs filtres et la lecture
des musiques. La caisse accepte le défilement à la molette.

[native-engine.js](public/features/room/native-engine.js) exécute les scénarios
d’Adi : variables, postures, choix de séquences et historique des répliques.
[native-view.js](public/features/room/native-view.js) affiche les atlas, coordonne
les voix et mouvements de bouche et applique les trajectoires. Les routines sont
fournies par [generated/original-room.js](public/features/room/generated/original-room.js).

[idle.js](public/features/room/idle.js) gère les séquences d’attente des menus et
leur interruption. Les gestes automatiques respectent les interactions manuelles
et la préférence système de réduction des animations.
Les [ressources de la chambre](public/game/room/) comprennent décors, clips,
scénarios, textes, trajectoires et sons.

## Station Sciences

[scenes.js](public/features/science/scenes.js) décrit les décors, destinations et
zones cliquables. [simulations.js](public/features/science/simulations.js) présente
le catalogue et sélectionne l’une des 14 expériences.

Les modules de [simulations](public/features/science/simulations/) définissent
les commandes et comportements propres à chaque expérience.
[simulation-view.js](public/features/science/simulation-view.js) gère leur
présentation, les médias, réglages et défis.
[interaction-model.js](public/features/science/interaction-model.js) fournit les
rectangles interactifs, la visibilité et la correspondance des choix.
Il applique les bornages selon les états courants et la situation.

[simulation-state.js](public/features/science/simulation-state.js) conserve les
états, les parcours de défis et la mémoire temporaire de la foudre. Chaque clic
évalue une seule fois les objets de sa séquence `SEQS`, dans leur ordre d’origine.
L’initialisation utilise `ETATINI` sans calcul anticipé des résultats de GO.
Les règles et médias par situation sont décrits dans
[generated](public/features/science/generated/).
[sequence-player.js](public/features/science/sequence-player.js) orchestre les
transitions VMD/RMD, leurs états intermédiaires et les voix des observations.
Il lit les durées des WebP animés et annule les attentes au changement de scène
ou à la réinitialisation. La vue conserve l’ordre de dessin des étapes.
Les films de la fourmilière utilisent
[cinema-player.js](public/features/science/cinema-player.js) : le cadre original
`07ZOOM` entoure une vidéo opaque avec son intégré, à la position `(121, 112)`.
La fin du film, sa fermeture et la réinitialisation retirent le gros plan et
restituent le décor sous-jacent ; les films ne constituent pas des calques persistants.

[simulation-engine.js](public/features/science/simulation-engine.js) évalue les
règles sans dépendre du DOM. Il utilise les
[calculs générés](public/features/science/generated/original-calculations.js).
[greenhouse-rules.js](public/features/science/greenhouse-rules.js) décrit les règles
de culture et leur validation. Le code généré est distinct des modules écrits
manuellement et exclu du formatage automatique.

La fabrication des laitages utilise
[dairy-sequence.js](public/features/science/simulations/dairy-sequence.js) pour
l’ordre des opérations et
[dairy-player.js](public/features/science/simulations/dairy-player.js) pour leur
lecture après Power. Chaque étape conserve son image finale ; le lecteur
restaure le décor derrière la souris et annule la séquence à l’arrêt ou à la sortie.

Les [données et médias des simulations](public/game/station/),
[décors](public/game/scenes/) et [ressources de la serre](public/game/greenhouse/)
sont livrés avec l’application. La fidélité de certaines séquences animées et
interactions au jeu original reste une limite du portage.

## Jeux

Les règles JavaScript sont séparées du DOM dans les modules `engine.js` ; les
modules `view.js` affichent les états et relient les commandes au moteur.

| Jeu | Modules | Données |
|---|---|---|
| Sokoban | [Moteur et vue](public/features/games/sokoban/) | [15 niveaux et atlas](public/game/sokoban/) |
| Mr. Matt I et II | [Moteur et vue partagés](public/features/games/mrmatt/) | [I](public/game/mrmatt1/) et [II](public/game/mrmatt2/) |
| Bad Toys 3D I à IV | [Moteur, rendu et vue](public/features/games/badtoys/) | [Cartes, sprites et sons](public/game/badtoys/) |
| Goblins I à III | [Vue](public/features/games/wgob3/view.js) et [lecteur](public/wgob3/) | [I](public/game/wgob1/), [II](public/game/wgob2/), [III](public/game/wgob3/) |

Mr. Matt partage un moteur, un atlas et 12 sons entre ses deux épisodes ; chaque
épisode possède son catalogue de niveaux. Les clés de sauvegarde sont
`adi4-mrmatt1-v1` et `adi4-mrmatt2-v1`. Les
[tests du moteur](tests/mrmatt-engine.test.mjs) comparent les déplacements aux
solutions et aux [empreintes des plateaux de Mr. Matt II](tests/fixtures/mrmatt2-native.json).

Bad Toys utilise un moteur commun et des cartes propres à chaque épisode.
Le rendu projette les textures et sprites sur le canvas. La progression de
l’épisode I utilise `adi4-badtoys-v1` ; les épisodes II à IV utilisent les suffixes
`-episode-2`, `-episode-3` et `-episode-4`.

Les Goblins utilisent le [moteur Gob de ScummVM](public/vendor/wgob3/) compilé
en WebAssembly. Le lecteur accepte `game=wgob1`, `game=wgob2` ou `game=wgob3`
dans la chaîne de requête ; sa valeur par défaut est `wgob3`. Chaque manifeste
identifie l’édition française Windows et les empreintes des fichiers à charger.
Goblins II et III disposent de montages IndexedDB et de formats d’import/export
séparés. Gobliiins utilise des codes de niveau.

## Planète Internet

[view.js](public/features/internet/view.js) ouvre le document
[internet.html](public/internet.html) dans une iframe.
[internet.js](public/internet.js) charge le
[lecteur](public/features/internet/player.js) ;
[internet.css](public/internet.css) charge les
[styles dédiés](public/styles/internet.css).

[engine.js](public/features/internet/engine.js) gère les textes, chapitres, votes,
correspondants fictifs, messages, réservations, résultats, points et réglages.
Il ne dépend ni du DOM ni du réseau et utilise `adi4-internet-local-v1`.
[calendar.js](public/features/internet/calendar.js) centralise les calculs de
créneaux et d’heures locales, y compris les changements d’heure.
Les [catalogues et médias](public/game/internet/) alimentent les écrans.

La politique CSP limite les ressources au même site et interdit les soumissions
de formulaires. L’iframe autorise les scripts, le stockage de même origine,
les téléchargements, dialogues et événements de formulaire ; le lecteur
intercepte les soumissions. Elle ne constitue pas une frontière de sécurité
vis-à-vis du parent de même origine.

Le parent contrôle l’origine et la fenêtre émettrice des messages de sortie.
Un `ResizeObserver` ajuste la hauteur au contenu. Les observateurs et écouteurs
sont retirés à la sortie. Les écrans ne se connectent pas au
[serveur TCP du client original](../serveur/README.md).

## Ressources, build et cache

[asset-manifest.json](asset-manifest.json) inventorie les fichiers livrés sous
[public/game](public/game/) et [public/vendor](public/vendor/), avec taille et
SHA-256. [asset-manifest.mjs](tooling/asset-manifest.mjs) vérifie leur présence et
leur intégrité. [build.mjs](build.mjs) exécute ce contrôle avant de construire
la distribution ; une ressource absente ou altérée provoque un échec explicite.

[update-asset-manifest.mjs](tooling/update-asset-manifest.mjs) régénère le manifeste
depuis les ressources suivies par Git. Les nouveaux médias doivent être ajoutés
à l’index avant son exécution. Le manifeste et les ressources correspondantes
font partie du même commit.

[source-files.mjs](tooling/source-files.mjs) inventorie les modules et styles
applicatifs. [release-assets.mjs](release-assets.mjs) calcule leur empreinte et les
copie sous une URL de version, en conservant les imports relatifs. Les points
d’entrée de la page principale et de la planète Internet utilisent ces URL.
Les médias et le lecteur ScummVM utilisent leurs chemins absolus.

[style.css](public/style.css) importe les feuilles de base, accueil, sciences,
chambre, jeux, Bad Toys et radio/caisse. [mrmatt1.css](public/mrmatt1.css) charge
les styles Mr. Matt. Les médias et le moteur tiers sont exclus du formatage par
[.prettierignore](.prettierignore) ; [.prettierrc.json](.prettierrc.json) définit
le formatage du code manuel.

[server.mjs](server.mjs) sert les sources ou la distribution sur la boucle locale.
Il configure les types MIME, les requêtes `HEAD` et les plages d’octets nécessaires
à la lecture des médias.

## Validation

Depuis ce dossier :

```sh
npm run check
npm test
npm run build
PORT=4176 npm run preview
```

[check.mjs](check.mjs) contrôle la syntaxe des modules, outils et tests.
La [suite de tests](tests/) couvre les règles, sauvegardes, catalogues, empreintes
des ressources, liens de cours, scénarios de chambre et graphe d’imports du build.
Les vérifications dans le navigateur complètent ces tests pour les commandes,
les médias et le rendu des écrans.
