# Transport ADI 4.21 : première connexion

Sources primaires locales : `LOADSERV.DLL` original, les scripts TOT/IDE extraits,
les INF d'origine et les paquets reçus du véritable `ADI4.EXE` sous Wine.
La simulation web n'est pas utilisée comme spécification.

## Cadre TCP

Tous les entiers sont little endian. La réception doit accumuler les octets : un
appel `recv` ne correspond pas nécessairement à un cadre.

| Position | Taille | Sens |
| --- | --- | --- |
| 0 | 2 | Identifiant `0xF11F` : octets `1f f1` |
| 2 | 4 | Taille du corps, hors en-tête |
| 6 | 1 | Type : 1 notification, 2 requête, 3 réponse, 4 IRX, 5 IRY |
| 7 | 1 | Somme des octets du corps modulo 256 |
| 8 | variable | Corps |

Construction : `LOADSERV!10002940`, somme : `10002b80`, envoi : `100026d0`.
Lecture de l'en-tête : `10001ee0` et `10001a70`. Primitives natives à `100044f0`,
`100046b0`, `100047a0`, `10004890` : écritures directes des entiers x86.

Corps de type 2/3 : opération u16, identifiant de requête u32, indicateur de cache
u8, puis éventuellement un u32 de cache si indicateur non nul, puis données.
Le serveur renvoie le même identifiant de requête et un indicateur de cache nul.
Source : `10002a70` (construction), `10002ae0` (lecture et remise au jeu).
Le corps de type 1 commence directement par l'opération u16 puis les données.
Le bit `8` active une compression propre au transport ; elle est **non implémentée**.
Le serveur refuse ces types plutôt que d'interpréter les données compressées.

Exemple authentique reçu au premier lancement :

```text
1ff1 12000000 02 21 3700 01000000 00 004601a5010000ffffffff
```

Requête 55, identifiant 1, 11 octets de données : plateforme/langue/produit/version
et référence de dernière mise à jour. Le détail des trois premiers champs provient
de `IRQ_LISTUPDA @2412` et doit encore être rapproché de tous les libellés.
Réponse « zéro mise à jour » acceptée :

```text
1ff1 0f000000 03 38 3700 01000000 00 00000000 00000000
```

## Opérations de la première connexion (prototype initial)

| ID | Nom du script | Données de réponse de ce prototype | Source / preuve |
| --- | --- | --- | --- |
| 55 | LISTUPDATE | u32 référence 0, u32 nombre 0 | `AI_REQUE IRR_LISTUPDA @54d6`, écran première visite accepté |
| 28 | FIRSTCON | u8 succès 0, chaîne 12 octets `LOCAL000001\0`, u8 test 0 | `IRR_FIRSTCON @322e`, code affiché et sauvegardé par le jeu |
| 27 | CONNECT | u8 succès 0, u8 test 0 | `IRR_CONNECT @2f5a`, requête suivante reçue |
| 30 | CHILDCON | u8 succès 0, u32 identifiant fictif 707 | `IRR_CHILDCON @2e6e`, requêtes de session suivantes reçues |
| 53 | ONCHILDCON | u8 succès 0 | `IRR_ONCHILDC @2ef7`, variante de reconnexion |
| 29 | LISTONCHILD | u32 nombre 0 | `IRR_LISTONCH @7202`, liste des enfants en ligne, enregistrements de 52 octets |
| 65 | GIVESUBS | 60 octets nuls | `IRR_GIVESUBS @6d5f`, structure copiée vers `SUBBUY.LST` (4+2+14+40 octets), pas d'abonnement |
| 6 | GIVEDATE | u32 secondes de calendrier local depuis 1970 | `IRR_GIVEDATE @3dde`, `AI_LINT1 @6b2a`, external 510 → `ADI4!0044c91d` |

La conversion de date du client additionne jours depuis 1970, heures, minutes et
secondes sans conversion de fuseau dans `0044c91d..0044cba3`. Le serveur représente
la date/heure locale de sa machine avec ce même compteur. Il ne modifie jamais
l'heure système. Le comportement à la limite des dates 2038 reste non testé.

`FIRSTCON` reçu contient 327 octets : nom 36, prénom 36, adresse 71, ville 36,
code postal 12, téléphone 21, email 80, fournisseur 24, pays u16, mot de passe
8, option 1. Ces dimensions proviennent de `IRQ_FIRSTCON @13b2` et concordent
avec le paquet capturé. Les essais ont utilisé uniquement des coordonnées fictives
et l'option originale « Ne plus demander de mot de passe » dans la copie de test.
Le prototype initial utilisait un code et l'identifiant 707 fixes. La version
persistante attribue les codes et les identifiants dans SQLite et vérifie le mot de
passe local. La migration explicite conserve LOCAL000001/707. Aucun compte distant
ni aucune base historique ne sont reproduits.

## Maintien de connexion

Le serveur envoie toutes les 30 secondes le cadre vide de type 4 :
`1ff1000000000400`. Le client renvoie ce même cadre, observé dans les journaux.
`ListeningThread @100033f0` répond automatiquement aux IRX. Le serveur **ne répond
pas une seconde fois** à cet accusé, ce qui évite une boucle infinie.
Le client envoie aussi un type 5 vide après inactivité. Ce dernier n'appelle pas de
réponse dans `ListeningThread`. Sans messages du serveur, un essai précédent a
fini par afficher une erreur de ligne : une socket ouverte ne suffit pas.

## Limites

La séquence complète après redémarrage a atteint l'accueil original sans dialogue
d'erreur : `55 → 27 → 53 → 29/65/6`, le 12 septembre 2026 à 21:13:17 UTC.
FIRSTCON et CHILDCON avaient été acceptés lors de l'inscription précédente.

La version persistante conserve les comptes, profils enfants et boîtes de réception.
La synchronisation complète des profils et la présence en ligne restent à développer. Une opération inconnue est
journalisée et reste sans réponse ; le client peut finir par afficher une erreur.
La liste d'opérations ci-dessus indique les données produites ; le [journal et les
captures](references/README.md) indiquent séparément celles effectivement acceptées
par le client. Aucun téléchargement de mise à jour, classe, jeu réseau, achat,
forum n'est implémenté. Le courrier local est décrit ci-dessous. Les codes de succès ont un sens dans ce laboratoire
local, sans prétendre reconstituer les règles de l'ancien service.

## Courrier local persistant — version SQLite

Correction de nomenclature : l'opération **29 est LISTONCHILD**, pas LISTCHILD.
La vraie LISTCHILD porte l'ID 17. La confusion du premier rapport n'affectait pas
les réponses vides, mais aurait donné un mauvais format pour une liste non vide.

Les réponses CONNECT et FIRSTCON portent désormais l'autorisation `TESTWO=5` :
bit 0 pour le courrier (`AI_LINT2 AllowUser @0ddb`, `AI_MAIL @00bd`), bit 2 pour
son accès par le forum (`AI_FORUM @0589`). Il s'agit d'autorisations locales du
prototype, sans abonnement acheté ni compte distant.

| Opération | Requête | Réponse / effet |
| --- | --- | --- |
| 31 LISTMAIL | u8 catégorie 5, u32 enfant | u32 nombre puis enregistrements de 75 octets |
| 32 READMAIL | u32 message, u8 direction 0, u8 catégorie 5, u32 enfant | u8 succès 0, u8 auteur 1 (Adi), u32 nombre d'identifiants 0, u32 longueur du document, document RTF |
| 37 DELETEMAIL | notification : u32 message, u8 direction 0, u8 catégorie 5 | Suppression persistante dans la boîte du profil connecté ; pas de réponse TCP applicative |
| 59 GIVECHECK | u32 enfant | u8 succès 0, u8 contrôle 3, i32 durée forum −1, u8 0, u8 0 ; préalable à l'accès au forum |

Un enregistrement LISTMAIL contient : u32 message, u8 état (1 non lu / 2 lu),
u8 direction (0 reçu), u8 type auteur (1 Adi), nom 24 octets, titre 40 octets,
u32 date. Les chaînes de la liste sont en CP850 avec NUL ; le contenu est un RTF
ASCII avec échappements Unicode. Sources : `AI_REQUE @4e59, @57bb, @12ae` et
`AI_LINT2 ListeMAIL @5474`. Les déchiffrages complémentaires sont conservés dans
`analysis/mail-scripts.txt`, `analysis/mail-details.txt`, `analysis/mail-library.txt`.

Les réponses aux requêtes mises en cache par le client sont toujours complètes,
avec indicateur de cache nul. Lire marque le message en base ; supprimer conserve
une date de suppression et exclut le message des listes futures. La liste présente
les 200 messages les plus récents encore présents. La boîte parent (catégorie 100),
l'envoi depuis l'éditeur du jeu (opération 33 compressée), les destinataires/copains
et les pièces jointes restent hors de cette première fonction. Le dépôt local par
`mail.py deliver` alimente la boîte sans serveur SMTP ni adresse email.

GIVECHECK est interprété par `AI_LINT2 CheckUser @0f7d` et
`AI_REQUE IRR_GIVECHEC @33cb`. La durée −1 autorise l'accès local sans limite de
temps. Ce paramétrage de laboratoire ne reconstitue pas un panneau de contrôle parental.
