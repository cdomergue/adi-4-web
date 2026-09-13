# Protocole du serveur ADI 4.21

Le serveur implémente une partie du protocole TCP du client Windows ADI 4.21.
[server.py](server.py) définit le transport et la répartition des opérations,
[storage.py](storage.py) les données persistantes et
[classes.py](classes.py) les opérations de classes virtuelles.
La planète Internet web utilise un moteur indépendant.

## Cadre TCP

Tous les entiers sont little endian. La réception accumule les octets : un appel
`recv` ne correspond pas nécessairement à un cadre. Le corps est limité à 1 Mio.

| Position | Taille | Sens |
|---|---|---|
| 0 | 2 | Identifiant `0xF11F` : octets `1f f1` |
| 2 | 4 | Taille du corps, hors en-tête |
| 6 | 1 | Type : 1 notification, 2 requête, 3 réponse, 4 IRX, 5 IRY |
| 7 | 1 | Somme des octets du corps modulo 256 |
| 8 | variable | Corps |

Le corps des types 2 et 3 contient : opération u16, identifiant de requête u32,
indicateur de cache u8, éventuellement un u32 de cache si l’indicateur est non
nul, puis les données. Le serveur renvoie le même identifiant de requête et un
indicateur de cache nul. Le corps du type 1 commence par l’opération u16 puis
les données, sans identifiant de requête.

Le bit `8` active une compression propre au transport, non prise en charge.
Les types compressés sont refusés.

Exemple de requête LISTUPDATE :

```text
1ff1 12000000 02 21 3700 01000000 00 004601a5010000ffffffff
```

Réponse indiquant zéro mise à jour :

```text
1ff1 0f000000 03 38 3700 01000000 00 00000000 00000000
```

## Connexion et session

Les opérations 27 et 28 ouvrent une session de compte. Les opérations 30 et 53
sélectionnent un profil enfant appartenant à ce compte. Les autres opérations,
sauf LISTUPDATE, nécessitent une session de compte.

| ID | Nom | Réponse et comportement |
|---|---|---|
| 55 | LISTUPDATE | u32 référence 0, u32 nombre 0 |
| 28 | FIRSTCON | u8 succès 0, code de compte terminé par NUL, u8 autorisations 13 |
| 27 | CONNECT | Succès : u8 0, u8 autorisations 13 ; échec : u8 4, u8 0 |
| 30 | CHILDCON | u8 succès 0, u32 identifiant du profil |
| 53 | ONCHILDCON | u8 0 si le profil appartient au compte, sinon u8 1 |
| 29 | LISTONCHILD | u32 nombre 0 : présence en ligne non gérée |
| 65 | GIVESUBS | u32 0, u8 255, u8 0, puis 54 octets nuls |
| 6 | GIVEDATE | u32 compteur de secondes de calendrier local depuis 1970 |

FIRSTCON attend 327 octets : nom 36, prénom 36, adresse 71, ville 36, code postal
12, téléphone 21, email 80, fournisseur 24, pays u16, mot de passe 8, option 1.
CONNECT attend 21 octets, dont un code sur 12 octets et un mot de passe sur 8.
CHILDCON attend 52 octets. ONCHILDCON contient un identifiant u32, un nombre u32,
puis autant d’identifiants u32 que le nombre annoncé.

SQLite attribue les codes de compte et identifiants de profils. Les mots de passe
sont vérifiés avec des hachages PBKDF2 salés. Les autorisations 13 correspondent
aux bits 0, 2 et 3 : courrier, accès au forum et classes virtuelles. Les crédits
et autorisations sont des valeurs locales ; ils ne représentent pas un abonnement
au service d’origine.

Le compteur GIVEDATE représente la date et l’heure locales de la machine, sans
conversion de fuseau. Le serveur ne modifie pas l’heure système. Le comportement
du client à la limite de 2038 n’est pas couvert par les tests.

## Maintien de connexion

Toutes les 30 secondes, le serveur envoie le cadre vide de type 4 :
`1ff1000000000400`. Le client renvoie ce cadre ; le serveur le traite comme un
accusé et ne répond pas à nouveau. Le type 5 vide n’appelle pas de réponse.

## Courrier

La boîte de réception utilise la catégorie 5 et l’identifiant du profil connecté.
Le serveur contrôle que les demandes correspondent à cette boîte.

| Opération | Requête | Réponse ou effet |
|---|---|---|
| 31 LISTMAIL | u8 catégorie 5, u32 enfant | u32 nombre puis enregistrements de 75 octets |
| 32 READMAIL | u32 message, u8 direction 0, u8 catégorie 5, u32 enfant | Succès : u8 0, u8 auteur 1, u32 nombre d’identifiants 0, u32 longueur, document RTF |
| 37 DELETEMAIL | Notification : u32 message, u8 direction 0, u8 catégorie 5 | Suppression persistante dans la boîte connectée ; pas de réponse applicative |
| 59 GIVECHECK | u32 enfant | u8 succès 0, u8 contrôle 255, i32 durée −1, u8 0, u8 nombre de réservations plafonné à 255 |

Un enregistrement LISTMAIL contient : u32 message, u8 état (1 non lu, 2 lu),
u8 direction 0, u8 auteur 1, nom sur 24 octets, titre sur 40 octets, u32 date.
Les chaînes de la liste sont en CP850 avec NUL ; le document RTF utilise des
échappements Unicode. READMAIL renvoie un indicateur d’échec si le message n’est
pas disponible dans la boîte sélectionnée.

Lire marque le message en base. Supprimer conserve une date de suppression et
exclut le message des listes. La liste présente les 200 messages les plus récents
encore présents. Les réponses sont complètes, avec indicateur de cache nul.
L’outil [mail.py](mail.py) alimente les boîtes depuis la machine du serveur.

## Classes virtuelles

[classes.py](classes.py) gère le catalogue, les séances, réservations, places,
fiches, listes d’élèves et résultats. Les identifiants d’opérations sont regroupés
dans `OPCODES`. [class-catalog.json](class-catalog.json) fournit les codes et
intitulés des 222 séances de maths et de français.

Une réservation occupe une des six places d’un créneau d’une heure. Un élève
ne peut pas réserver deux matières au même horaire. Les demandes d’archives
pédagogiques reçoivent une réponse « ressource absente » ; le serveur n’émet pas
de signal de démarrage d’exercice sans ces archives.
Le [README](README.md) décrit les commandes d’administration et les limites.

## Limites et validation

La compression, la boîte parent, l’envoi depuis l’éditeur du jeu, les copains,
les pièces jointes, les achats, les forums de discussion et la présence en ligne
ne sont pas pris en charge. La synchronisation complète des profils et d’une
séance de classe n’est pas implémentée.

Une opération inconnue est journalisée et ne reçoit pas de réponse applicative ;
le client peut afficher une erreur de connexion. Les cadres invalides provoquent
la fermeture de la connexion. Aucun ancien service Internet n’est contacté.

[test_server.py](test_server.py) vérifie le transport, la session et le courrier.
[test_classes.py](test_classes.py) couvre les classes et réservations. Ces tests
utilisent SQLite et des sockets de boucle locale, sans client Windows.
