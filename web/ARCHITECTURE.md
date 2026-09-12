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
      welcome.js                  accueil provisoire
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
      science/
        scenes.js                 décors et zones cliquables
        simulations.js            interfaces des simulations
        simulation-engine.js      adaptation des calculs aux objets extraits
        greenhouse.js             interface de la serre
        greenhouse-rules.js       règles et validation de la serre
        generated/                calculs issus des scripts originaux
      games/
        mrmatt/{view,engine}.js    interface et règles de Mr. Matt
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
