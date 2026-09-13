# Organisation de la version web

L’application reste statique et utilise les modules JavaScript natifs du navigateur. Node.js suffit pour servir, vérifier et construire le site ; il n’y a pas de dépendance npm à installer pour jouer. Cette réorganisation conserve les routes, données, textes, sauvegardes, commandes et règles existantes.

## Où intervenir

```text
web/
  index.html                      structure de la page
  public/
    app.js                        chargement du catalogue et initialisation
    application/
      shell.js                    dialogue, notifications, bouton À propos
      router.js                   routes et navigation active
      welcome.js                  accueil et introduction originale du vaisseau
    features/
      courses/
        library.js                filtres, cours, historique, carnet, dictionnaire
        links.js                  décodage des liens originaux #EMM
        encyclopedia.js           recherche et ouverture des médias
      room/
        room.js                   chambre, objets et barre d’activités
        activities.js             menus natifs de la caisse et de la radio
        games.js                  point d’entrée de la caisse
        idle.js                   gestes d’attente et interruption des séquences
        native-engine.js          scénarios originaux, postures, pauses et sélection
        native-view.js            atlas VMD, voix FLAC, bouches BCH et trajectoires AD4
        generated/original-room.js bytecode de la chambre compilé sans eval
        ambient.js                ancien prototype, remplacé dans la chambre
      science/
        scenes.js                 décors et zones cliquables
        simulations.js            catalogue et entrée commune des 14 expériences
        simulations/*.js          commandes et particularités de chaque expérience
        simulation-view.js        scènes, panneaux, voix, réglages et défis partagés
        interaction-model.js      rectangles natifs, visibilité et réglages par cas
        simulation-engine.js      adaptation des calculs aux objets extraits
        greenhouse-rules.js       règles et validation de la serre
        generated/                calculs issus des scripts originaux
      games/
        badtoys/{view,engine,renderer}.js moteur partagé Bad Toys, cartes par épisode
        mrmatt/{view,engine}.js    interface et règles partagées de Mr. Matt I et II
        sokoban/{view,engine}.js   interface et règles de Sokoban
        wgob3/view.js             intégration du lecteur autonome
    shared/text.js                échappement HTML et normalisation de recherche
    styles/                       feuilles lisibles regroupées par écran
    style.css, mrmatt1.css         points d’entrée CSS, conservés à leur URL
    game/                         ressources originales et manifestes
    vendor/wgob3/                 moteur tiers compilé, conservé sans modification
    wgob3/                        lecteur autonome et sauvegardes WGOB3
  tooling/source-files.mjs         inventaire du code de l’application
  check.mjs                       contrôle syntaxique récursif
  release-assets.mjs              copie versionnée des modules et styles
  build.mjs                       distribution statique
  server.mjs                      serveur local, types MIME et requêtes Range
  tests/                          règles, ressources et infrastructure du build
```

## Responsabilités et dépendances

`app.js` construit l’interface commune et la bibliothèque de cours, charge le catalogue, puis installe le routeur. Le routeur décide de l’écran à afficher et arrête les médias de l’écran précédent. Il ne gère ni le contenu des cours ni les règles des jeux.

`createCourseLibrary` conserve dans une instance les filtres, l’historique des pages, les cours lus et le carnet. Son API publique expose les écrans, l’ouverture d’un cours et le niveau courant. Les clés de stockage d’origine, dont `adi4-v1` et `adi4-mrmatt1-v1`, ne changent pas ; aucune migration ni réinitialisation des sauvegardes n’est nécessaire.

Les fichiers `engine.js` et les règles Sciences ne dépendent pas du DOM. Les interfaces `view.js` rendent ces états et relient les commandes du navigateur au moteur. Les gestes d’attente restent interruptibles, afin de ne pas remplacer une animation explicitement choisie par l’utilisateur.

Les calculs de `features/science/generated/original-calculations.js` restent générés et ne sont pas reformattés. Leur générateur est `../scripts/compile_calculations.py`, dont le chemin de sortie a été adapté. Les médias extraits restent dans `public/game/` : déplacer du code n’implique pas de les extraire de nouveau.

## Construction et cache

La fabrication des laitages utilise `simulations/dairy-sequence.js` pour l’ordre
des opérations extrait de SEQS et `simulations/dairy-player.js` pour leur lecture
séquentielle après Power. Le lecteur conserve les images finales entre les étapes,
restaure le décor derrière la réaction transparente de la souris et annule la
séquence à l’arrêt ou à la sortie. `scripts/prepare_dairy.py` régénère les atlas
VMD fournis dans `game/station/dairy/` ; les sources ne sont pas nécessaires au jeu.


`applicationFiles` inventorie les fichiers JS/CSS à la racine de `public/` et récursivement dans `application/`, `features/`, `shared/` et `styles/`. Les données du jeu, les ressources tierces et le lecteur WGOB3 autonome suivent leurs chemins et manifestes existants.

Le build copie cet ensemble sous `/releases/<empreinte>/` en conservant les dossiers. Tous les imports applicatifs sont relatifs : changer un module imbriqué ou un style importé renouvelle également l’adresse du point d’entrée. Les chemins absolus `/game/...`, `/vendor/...` et `/wgob3/player.html` restent stables. Les tests vérifient la résolution de chaque import et le renouvellement du cache lors d’un changement profond.

`style.css` importe les feuilles dans l’ordre historique : base, sciences, chambre, jeux, radio/caisse. `mrmatt1.css` reste chargé ensuite. L’ordre de cascade, les sélecteurs, les déclarations et les media queries sont conservés.

## Vérifier une modification

Depuis `web/` :

```bash
npm run check
npm test
npm run build
PORT=4176 npm run preview
```

La suite couvre notamment les 25 solutions originales de Mr. Matt, les 15 niveaux de Sokoban, les 960 réglages de la serre, les 14 simulations, les sauvegardes WGOB3, les médias de la radio et le graphe de modules du build. Les nouvelles fonctions doivent être placées dans leur domaine ; `check` les prend alors en compte sans ajouter leur chemin à une longue commande manuelle.

Le formatage est défini dans `.prettierrc.json`. Commande facultative de développement : `npx --yes prettier@3.6.2 --write .`. Les fichiers générés, les médias et le moteur tiers sont exclus via `.prettierignore`. Prettier n’est pas requis pour lancer ou construire le site.

## Vérification de cette réorganisation

Validation locale : contrôle syntaxique, suite complète et build réussis. Les arbres syntaxiques de 16 modules déplacés ont été comparés à la version précédente, en normalisant la mise en forme et en excluant les imports déplacés ; leur logique est inchangée. La concaténation des nouvelles feuilles CSS a également été comparée à la feuille précédente : mêmes déclarations et même ordre de cascade.

Parcours vérifiés dans le navigateur sur le build local : chambre, radio et lecture, recherche de cours, carnet après rechargement, marquage lu, définition liée, complément illustré, historique des pages, ouverture des trois jeux, commandes de la serre, simulation des laitages et recherche de l’encyclopédie. Le carnet utilisé pour le test a été remis dans son état initial. Aucune erreur console n’a été relevée pendant ces parcours.

Les tests ne signifient pas que les fonctionnalités encore incomplètes du portage original sont achevées. Cette modification conserve leur état actuel. Aucun déploiement n’est effectué avec ce refactoring.

## Scénarios de la chambre

`compile_room_scripts.py` traduit les routines CCONT et les sélecteurs EDIINTRO/LIBAPPEL,
ainsi que les choix de voix, décors et textes de LIBADI/IMAGE/LANGUE. `native-engine.js`
garde les variables et les historiques ; il reçoit les fins des pistes audio/vidéo.
`native-view.js` conserve les rectangles VMD entre deux clips, lit les atlas sans
interpoler les pixels, et coordonne les voix et les bouches mobiles. Les scénarios
n’utilisent plus les temporisations inventées de l’ancien `ambient.js`.

`prepare_room_native.py` exporte les médias dans `game/room/native/`, y compris les
trajectoires AD4 et les messages français. Le jeu web utilise uniquement ces exports.
Les originaux et Python sont nécessaires à la régénération, pas à la lecture.
Le banc d’essai temporaire n’entre pas dans le build. Voir `reports/chambre-scenarios-natifs.md`
pour les preuves et les limites du portage.

## Planète Internet

La route `#internet` et le bouton Internet de la chambre utilisent
`features/internet/view.js`. Le lecteur est chargé dans `/internet.html` :
`internet.js` importe `features/internet/player.js`, et `internet.css` importe
`styles/internet.css`. Ce document dédié permet une CSP limitant les ressources
au même site et interdisant les vraies soumissions de formulaires.

`features/internet/engine.js` ne dépend ni du DOM ni du réseau. Il gère les textes,
chapitres, votes, correspondants fictifs, messages, réservations, résultats, points
et réglages dans `adi4-internet-local-v1`. Les noms de personnages partagent ce
même dossier ; aucune des anciennes clés de sauvegarde n’est modifiée.
`player.js` rend les écrans, intercepte les formulaires, lit les médias et
coordonne les animations d’attente. Les adresses historiques restent du texte.
`calendar.js` fournit les calculs d’heures et de jours civils locaux : la grille
hebdomadaire et le moteur appliquent les mêmes règles, y compris aux changements
d’heure. Une réservation conserve son identifiant lors d’un changement de place
ou de séance ; les anciennes sauvegardes à la minute restent lisibles.

Le calendrier puis les six places, ainsi que la sélection du courrier avant
lecture et les confirmations de suppression, reprennent les parcours observés
dans le client original. Les exercices restent accessibles librement. Ces écrans
ne se connectent pas au serveur TCP Python et conservent le stockage navigateur.

L’iframe utilise `allow-scripts`, `allow-same-origin`, `allow-downloads`,
`allow-modals` et `allow-forms`. Ce dernier autorise les événements `submit`,
alors que `preventDefault()` et `form-action 'none'` empêchent un envoi réel.
Le parent vérifie l’origine et la fenêtre émettrice du message de sortie ; un
`ResizeObserver` ajuste la hauteur du cadre au contenu. Les observateurs et
écouteurs sont retirés lors de `sceneleave`/`pagehide`. L’iframe ne constitue pas
une isolation de sécurité vis-à-vis du parent de même origine.

`prepare_internet.py` produit `game/internet/catalog.json`, `lessons.json`,
`media.json`, `ambient.json` et les exports WebP/FLAC. Le manifeste conserve les
empreintes des sources/exports et les formats refusés. `inspect_internet.py`
produit les preuves de désassemblage ; `ghidra/InternetProtocol.java` analyse le
transport original sans le faire fonctionner. Les sources originales sont
nécessaires à la régénération, pas à la lecture du jeu web.
`prepare_internet_ui.py`, également appelé par le générateur principal, restitue
la transparence noire de sept sprites depuis les exports vérifiés. Il produit
des fichiers `ui-*.webp` et `ui-manifest.json` sans modifier les exports existants.

Le build versionne également les points d’entrée de `internet.html` sous
`/releases/<empreinte>/`. Les quatre JSON et médias restent sous `/game/internet/`.
Le lecteur affiche dans ses explications un audit des ressources de son document
et des violations CSP. Il ne mesure pas le trafic des autres onglets ou du système.

Les tests Internet couvrent les règles et la persistance, le catalogue, les
réponses extraites, les empreintes et les restrictions réseau. Les tests Python
couvrent aussi la lecture des blocs de texte et un exercice original. Voir
[le rapport Internet](../reports/internet-local.md) pour les parcours navigateur,
les captures, la régénération et les limites : 218 exercices pris en charge sur
2 354 modules, contenus serveur remplacés ou absents, formats encore non décodés.


## Bad Toys 3D

`features/games/badtoys/engine.js` gère la partie sans DOM ; `renderer.js` projette
les cartes et sprites originaux sur le canvas ; `view.js` possède les commandes,
la lecture des effets WAV et les sauvegardes par épisode (I conserve `adi4-badtoys-v1`). Le lecteur accepte
un identifiant d’épisode, séparé du moteur. Les quatre épisodes sont proposés dans
la caisse, sous `#game/bt3d_1` à `#game/bt3d_4`. Les sauvegardes de II à IV utilisent
le suffixe `-episode-2`, `-episode-3` ou `-episode-4`, sans écraser celle de I.

`scripts/prepare_badtoys.py` extrait le DatPack partagé et les tables des quatre
exécutables. Les exports de `game/badtoys/` permettent de jouer après clonage sans
Wine, Ghidra, Python ou installateur. Voir le [rapport de portage](../reports/badtoys-portage.md)
pour les preuves, captures, tests et différences restantes avec Windows.

## Mr. Matt I et II

Les routes `#game/mrmatt1` et `#game/mrmatt2` utilisent le même moteur et la même
vue paramétrée. Les deux EXE sont identiques ; seuls leurs packs MAT diffèrent.
Les niveaux et manifestes restent séparés dans `game/mrmatt1/` et `game/mrmatt2/`.
Le deuxième jeu réutilise l’atlas et les 12 sons distribués avec le premier.
Ses parties utilisent `adi4-mrmatt2-v1` ; la clé existante `adi4-mrmatt1-v1` reste
inchangée. Les compteurs de niveaux sont calculés depuis chaque catalogue.

`scripts/prepare_mrmatt1.py --episode 2` régénère le deuxième catalogue et vérifie
l’identité des médias partagés. `scripts/verify_mrmatt_native.py` produit les
empreintes de tous les plateaux d’une relecture des 35 solutions par les règles
machine originales. Les tests Node comparent le moteur web à ces empreintes,
sans dépendre du programme original ni de QEMU. Voir
[le rapport Mr. Matt II](../reports/mrmatt2-portage.md).

## Goblins 1, 2 et 3

Les trois routes `#game/wgob1`, `#game/wgob2` et `#game/wgob3` utilisent la vue
`features/games/wgob3/view.js` paramétrée par épisode. Le lecteur historique
`/wgob3/player.html?game=wgobN` conserve un seul moteur sous `vendor/wgob3/`.
Les manifestes et données originales se trouvent dans `game/wgob1/`,
`game/wgob2/` et `game/wgob3/`. Le lecteur vérifie leurs empreintes avant lancement.
Les fichiers de sauvegarde du deuxième et du troisième jeu restent séparés
par cible et montage IndexedDB ; le premier utilise des codes de niveau.
Voir [le rapport Goblins 1–2](../reports/goblins-1-2-portage.md).
