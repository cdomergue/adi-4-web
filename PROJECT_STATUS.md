# Priorités du projet ADI 4

## Décision utilisateur — 12 septembre 2026

La station Sciences reste **à terminer plus tard**. Le travail actif passe à la
chambre d’Adi et à la recréation des différents jeux, **y compris les exécutables
16 bits**, en les désassemblant/décompilant si nécessaire. Un échec sous Wine ne
justifie pas d’exclure un jeu du portage.

Préserver les graphismes originaux. Fonctionnement local, architecture déployable
ultérieurement. Utiliser les ressources, règles et niveaux originaux ; distinguer
les comportements vérifiés des hypothèses. Tenir des rapports avec captures.

## Station à reprendre

- 347 exercices : blocs de texte extraits, interactions encore à porter.
- Séquences d’Adi, aide, menus, transitions et synchronisation des animations.
- Validation native des simulations, visibilité des objets, progression sauvegardée.
- Vérification des zones cliquables face au jeu original et des médias manquants.

État détaillé : [bilan station](reports/station-portage.md).
Sources web committées dans `375c4a1`; extraction et rapports encore locaux.

## Première tranche chambre / jeux réalisée

Chambre avec barre native animée, accès matières/jeux et aide textuelle. Fond encore issu de la capture de référence, Adi statique. Sokoban jouable sur ses 15 niveaux originaux après décompilation NE avec Ghidra. Extraction des ressources des 32 NE effectuée (1 988 entrées). Autres jeux toujours à recréer. Voir [chambre et jeux](reports/chambre-et-jeux.md). Prochaine étape : utiliser Ghidra pour reconstruire plus fidèlement la chambre.
