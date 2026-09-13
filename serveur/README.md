# Serveur local ADI 4.21

Serveur TCP compatible avec la connexion, la boîte de réception et les réservations
des classes du client ADI original. Il conserve les comptes, profils enfants,
messages, places réservées et résultats reçus dans SQLite.

## Lancer le serveur

Python 3.10 ou plus récent, avec le module standard `sqlite3`, suffit. Aucune
installation `pip`, ressource du jeu, installation Wine ou compilation n'est
nécessaire pour exécuter le serveur. Le dossier `serveur/` peut être copié seul.

```sh
cd serveur
python3 server.py
```

Le serveur écoute uniquement sur **127.0.0.1:2001**. La base
`runtime/adi.sqlite3` et son dossier sont créés automatiquement au premier lancement.
Les événements sont écrits dans le terminal, sans mots de passe ni contenu des messages.
Arrêter avec `Ctrl+C` ; les données restent disponibles au prochain lancement.

Options facultatives :

```sh
python3 server.py --port 2001 --log runtime/server.jsonl
python3 server.py --db /chemin/vers/adi.sqlite3
python3 server.py --help
```

## Connecter le jeu

Le client ADI 4.21 doit être installé séparément. Dans une copie de test de son
fichier `INTERNET/POSTE.INF`, après sauvegarde de l'original, utiliser :

```ini
[Adresses]
Nombre=1
Adresse1=127.0.0.1

[Ports]
Port1=2001

[Types]
Type1=TCP/IP
```

Le client et le serveur doivent partager la même boucle locale ; si un espace
réseau isolé est utilisé, lancer les deux à l'intérieur. Depuis le jeu, choisir
Internet puis « Se connecter ». Avec une base neuve, suivre le parcours de première
visite pour créer un compte et un profil. Un code enregistré dans une autre base
n'est pas reconnu automatiquement.

## Courrier local

La boîte est accessible depuis **Forum → boîte aux lettres**. Chaque nouveau profil
reçoit un message d'accueil. Lecture, état « lu » et suppression sont persistants.
Les mots de passe des comptes sont stockés sous forme de hachages PBKDF2 salés.

Pour déposer un message depuis la machine du serveur :

```sh
python3 mail.py profiles
python3 mail.py deliver --child 1 --title "Un message pour toi" --body-file message.txt
```

Remplacer `1` par l'identifiant affiché par `profiles`. Le fichier `message.txt` est
du texte UTF-8 ; le titre accepte jusqu'à 39 octets CP850. Le contenu est converti
en RTF, jusqu'à 100 000 octets. Revenir à la boîte dans le jeu pour actualiser la
liste, qui présente les 200 messages les plus récents encore présents.

Avec une base personnalisée, préciser le même chemin aux deux outils :

```sh
python3 mail.py --db /chemin/vers/adi.sqlite3 profiles
```

## Données et limites

### Classes locales

Dans le jeu : **monde des classes virtuelles → calendrier → matière et niveau →
créneau → place libre → thème et séance → pouce de validation dans la barre du bas**.
Les six places sont gérées par le serveur. Une réservation occupe une seule place ;
un changement qui échoue conserve la réservation précédente. Les réservations et
annulations persistent après redémarrage. Un élève ne peut pas réserver deux
matières à la même heure. Les créneaux durent une heure, dans une fenêtre de 35 jours.

Le catalogue embarqué reprend les 222 intitulés de séances de maths et de français
du fichier `CLASSE.INF` du client 4.21. Il contient les codes et les titres, pas les
archives pédagogiques qui étaient téléchargées depuis l'ancien service. Les places
et le crédit affiché comme « Abonné » sont des données du serveur local.

Administration locale, depuis ce dossier :

```sh
python3 classes.py list
python3 classes.py reserve --child 707 --at 2026-09-13T08:00 --subject M --level 6 --theme G --lesson A --seat 1
python3 classes.py cancel --child 707 --class-id 1
```

Remplacer les identifiants et la date ; `mail.py profiles` liste les élèves.
`--at now` réserve le créneau courant. `--db` se place avant la sous-commande, comme
pour `mail.py`. Dans le protocole, les places sont numérotées de 0 à 5 ; l'option
`--seat` utilise 1 à 6. Au démarrage, la migration SQLite ajoute les tables de classes
sans supprimer comptes, profils ni courrier existants.

**Limite : les exercices des classes ne sont pas encore jouables.** L’accueil et la sortie de classe sont vérifiés dans le client original. Le serveur
implémente les demandes d'entrée, les fiches et la liste d'élèves, et sait enregistrer
les résultats reçus. Il répond explicitement « ressource absente » aux demandes
d'archives STK. Il n'envoie pas de signal de démarrage d'exercice sans ces archives.
L'historique graphique des résultats, la discussion entre élèves et l'animation
synchronisée d'une séance complète restent à implémenter.

### Sauvegarde

Le dossier `runtime/` est exclu de Git : chaque installation crée sa propre base.
Pour sauvegarder, utiliser l'API SQLite `Connection.backup`, ou arrêter le serveur
et les commandes de courrier avant de copier la base et ses éventuels fichiers
`-wal` et `-shm`. Ne pas supprimer ces fichiers pour redémarrer.

L'envoi du courrier depuis l'éditeur du jeu, la boîte parent, les copains, les forums
de discussion, les achats et la présence en ligne ne sont pas implémentés. Une opération inconnue est
journalisée et peut provoquer une erreur de connexion dans le client. Aucun ancien
service Internet n'est contacté par le serveur.
