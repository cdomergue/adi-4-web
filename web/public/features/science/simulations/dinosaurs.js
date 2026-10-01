export default {
  id: '11',
  cinema: {
    objects: ['5'], origin: [142, 48], label: 'Observation des dinosaures',
    catalog: '/game/science-media/catalog.json',
  },
  instructions: 'Choisis le lieu sur la carte, le moment de la journée et l’appât sur le pupitre. Clique sur le déclencheur à gauche de l’écran pour observer les dinosaures.',
  controls: {
    1: { mode: 'direct' },
    2: { mode: 'direct' },
    3: { mode: 'direct' },
    6: { mode: 'action', label: 'Déclencher l’observation des dinosaures' },
  },
};
