export default {
  id: '7',
  instructions: 'Choisis une saison en haut, puis clique dans une salle de la fourmilière ou sur les flèches d’entrée et de sortie. La caméra relance la séquence.',
  controls: {
    1: { mode: 'direct' },
    2: { mode: 'direct', clearState: 1, clearLabel: 'Quitter la salle observée' },
    3: { mode: 'action', label: 'Lancer la séquence de la fourmilière' },
  },
};
