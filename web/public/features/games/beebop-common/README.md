# Socle BeeBop

BeeBop I et II partagent les modules indépendants de leurs règles :

- [artwork.js](artwork.js) charge et met en cache les manifestes PNG par épisode.
  Il combine les deux moitiés masque/couleur des bitmaps de balle.
- [timing.js](timing.js) calcule l’attente calibrée, ses quotients entiers et
  ses crans de vitesse. Les coordonnées et sous-pas restent propres au moteur.
- [scores.js](scores.js) valide et classe dix entrées de dix-sept caractères.
  Les égalités suivent les entrées existantes. Chaque vue conserve sa clé de
  stockage et son unité d’affichage (points divisés par dix au classement de II).
- [cursor.js](cursor.js) masque le pointeur après un clic souris dans un jeu
  actif, et le réaffiche avec Échap, perte de focus, pause ou sortie du plein écran.
  Aucun verrouillage relatif du pointeur n’est demandé.

Les moteurs, dimensions, collisions, armes, passages et présentations ne sont
pas fusionnés : les exécutions natives montrent des règles distinctes.
