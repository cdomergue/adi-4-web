# ADI 4 Sciences

Reconstitution locale d’ADI 4 Sciences, organisée en deux projets complémentaires :

- `web/` est le portage jouable dans un navigateur : chambre d’Adi, station
  Sciences, cours, encyclopédie, Internet simulé et jeux.
- `serveur/` est un serveur local compatible avec le client original ADI 4.21.
  Il recrée une partie des services Internet historiques afin de pouvoir relancer
  l’exécutable Windows original dans un environnement de test.

Les deux projets sont volontairement séparés : l’application web fonctionne sans
serveur ni compte, tandis que le serveur parle au véritable client ADI 4.21 sur
`127.0.0.1:2001`. Le serveur ne contacte aucun ancien domaine Internet.

## Portage web

### Lancer l’application

Prérequis : Node.js 22 ou plus récent. Aucun `npm install` n’est nécessaire.

Depuis la racine du dépôt :

```bash
npm --prefix web run dev
```

Ouvrir ensuite <http://127.0.0.1:4173/>. Les entrées principales sont :

- `#room` : chambre d’Adi, radio et caisse de jeux ;
- `#scene/station` : station Sciences, cours et encyclopédie ;
- `#internet` : reconstitution locale de la planète Internet ;
- `#game/sokoban` : Sokoban ;
- `#game/wgob1`, `#game/wgob2`, `#game/wgob3` : Gobliiins / Gobliins 2 / Goblins 3 ;
- `#game/mrmatt1`, `#game/mrmatt2` : Mr. Matt I et II ;
- `#game/bt3d_1` à `#game/bt3d_4` : les quatre épisodes de Bad Toys 3D.

Les ressources déjà portées sont fournies dans `web/public/game/`. Les
sauvegardes de l’application et de certains jeux restent locales au navigateur.

### Vérifier et construire

```bash
npm --prefix web run check
npm --prefix web test
npm --prefix web run build
npm --prefix web run preview
```

`build` génère la distribution statique dans `web/dist/`. Pour l’architecture,
les modules et les limites du portage, voir [la documentation web](web/README.md)
et [l’état du projet](PROJECT_STATUS.md).

Les extractions des CD, l’installateur original et les médias non préparés restent
locaux et sont ignorés par Git. Ils sont nécessaires uniquement pour régénérer
certaines ressources, pas pour lancer les jeux web déjà inclus.

## Serveur local du jeu original

Le dossier `serveur/` constitue un projet distinct. Il contient un serveur TCP
Python avec SQLite pour le client original ADI 4.21 : connexion, profils enfants,
messagerie locale et réservations des classes virtuelles. Les comptes, messages,
réservations et résultats sont conservés dans `serveur/runtime/`, qui n’est pas
versionné.

### Lancer le serveur seul

Python 3.10 ou plus récent suffit ; aucune dépendance `pip` n’est requise :

```bash
python3 serveur/server.py
```

Le serveur écoute uniquement sur `127.0.0.1:2001`. Options utiles :

```bash
python3 serveur/server.py --port 2001 --log serveur/runtime/server.jsonl
python3 serveur/server.py --db /chemin/vers/adi.sqlite3
```

### Connecter le client Windows original

Le jeu original, Wine et ses ressources doivent être fournis séparément. Depuis
la racine du dépôt, préparer une copie de test sans modifier l’installation
source :

```bash
python3 serveur/prepare.py --prefill
```

Pour une session manuelle dans une fenêtre Xephyr :

```bash
bash serveur/run-visible.sh
```

Pour une session isolée et invisible sous Xvfb, sans accès réseau extérieur :

```bash
bash serveur/run-isolated.sh
```

Ces lanceurs redirigent la copie de test du fichier `INTERNET/POSTE.INF` vers
`127.0.0.1:2001`. Ils n’écrasent pas l’installation originale. Les prérequis
Wine, `unshare`, `ip`, Xephyr ou Xvfb sont détaillés dans [le mode d’emploi du
serveur](serveur/README.md).

### Administrer les données locales

Déposer un message dans une boîte :

```bash
python3 serveur/mail.py profiles
python3 serveur/mail.py deliver --child 707 \
  --title "Message local" --body-file message.txt
```

Gérer les réservations de classes :

```bash
python3 serveur/classes.py list
python3 serveur/classes.py reserve --child 707 --at now \
  --subject M --level 6 --theme G --lesson A --seat 1
python3 serveur/classes.py cancel --child 707 --class-id 1
```

Le serveur est une reconstitution locale et expérimentale, pas une remise en
ligne du service historique. Les forums, achats, présence en ligne, synchronisation
complète des profils et téléchargement des archives d’exercices ne sont pas
implémentés. Voir [le protocole étudié](serveur/PROTOCOL.md) et [les limites du
serveur](serveur/README.md).

## Tests

```bash
npm --prefix web run check
npm --prefix web test
python3 -m unittest discover -s serveur -p 'test_*.py' -v
```

Les tests Python du serveur utilisent des sockets de boucle locale et une base
SQLite temporaire. Les fichiers de runtime, les installations originales et les
captures de test ne doivent pas être ajoutés au dépôt.

## Arborescence

```text
web/       application navigateur, assets portés et tests JavaScript
serveur/   serveur local ADI 4.21, SQLite, outils et tests Python
scripts/   extraction, préparation des ressources et outils d’analyse
reports/   rapports de reverse engineering et de vérification
deploy/    notes de déploiement statique
```

Le projet documente séparément ce qui est vérifié sur le client original, ce qui
est simulé dans le navigateur et ce qui reste à porter. Les crédits, licences et
provenances sont conservés dans les fichiers et rapports concernés.
