# ADI 4 Sciences

Recréation d’ADI 4 Sciences, avec deux projets publiés dans ce dépôt :

- [L’application web](web/README.md) : chambre d’Adi, documents, radio, jeux, cours et station
  Sciences.
- [Le serveur ADI 4.21](serveur/README.md) : serveur TCP Python compatible avec
  une partie des services Internet du client Windows original.

L’application web est statique et fonctionne sans le serveur Python ni compte.
Sa planète Internet est simulée dans le navigateur. Le serveur Python s’adresse
au client original, fourni séparément, et écoute uniquement sur la boucle locale.
Il ne contacte aucun ancien service Internet.

## Jouer après clonage

Node.js 22 ou plus récent suffit ; aucun `npm install` n’est nécessaire.
Depuis la racine du dépôt :

```sh
npm --prefix web run dev
```

Ouvrir [la version locale](http://127.0.0.1:4173/).
La chambre, la radio, la planète Internet simulée et les dix jeux disponibles
ont leurs ressources dans Git : Sokoban, les trois Goblins, Mr. Matt I et II,
et les quatre épisodes de Bad Toys 3D. Les parties sont conservées dans le
navigateur, selon les possibilités de chaque jeu.

Les douze documents de la chambre sont consultables : cinq dossiers multimédias,
l’Atlas et six simulations d’environnement, avec les médias et les interactions
du jeu original. L’Atlas, la pollution de l’air et de l’eau, l’équilibre de la nature,
l’entreprise, la désertification et le développement d’un pays fonctionnent en
JavaScript natif. Aucun document ne charge de moteur ni d’archive binaire du jeu.

Le code et les ressources des cours, de l’encyclopédie et des 14 simulations
Sciences sont également inclus. Un clone contient les médias nécessaires au
client web, sans récupération depuis une installation de travail.
Voir [les fonctions et limites de la version web](web/README.md) et les
[finitions requises pour la fidélité au jeu](web/FIDELITY.md).

## Lancer le serveur du client original

Python 3.10 ou plus récent suffit, sans dépendance `pip` :

```sh
python3 serveur/server.py
```

Le serveur écoute sur `127.0.0.1:2001` et crée automatiquement sa base SQLite.
Il conserve les comptes, profils enfants, courriers, réservations de classes et
résultats reçus. Arrêter avec `Ctrl+C`.

Le [mode d’emploi du serveur](serveur/README.md) décrit la connexion, les commandes
d’administration et les limites. Le [protocole pris en charge](serveur/PROTOCOL.md)
est documenté séparément. Le serveur ne fournit pas le client Windows original
ni les archives pédagogiques nécessaires aux exercices des classes.

## Vérifier et construire

Depuis la racine du dépôt :

```sh
npm --prefix web run check
npm --prefix web test
npm --prefix web run build
python3 -m unittest discover -s serveur -p 'test_*.py' -v
```

Pour servir la distribution web générée :

```sh
npm --prefix web run preview
```

La construction utilise uniquement les ressources présentes dans la copie du
dépôt. Les tests du serveur utilisent une base temporaire et des sockets de
boucle locale ; ils ne nécessitent pas le jeu original.

## Organisation

- [Web](web/README.md) : démarrage, jeux, sauvegardes et hébergement statique.
- [Architecture web](web/ARCHITECTURE.md) : modules, règles et validation.
- [Serveur](serveur/README.md) : exécution et administration du service TCP.
- [Protocole](serveur/PROTOCOL.md) : messages et comportements pris en charge.
