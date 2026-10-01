export default {
  id: '13',
  cinema: {
    objects: ['11', '12'], origin: [171, 114], frame: '13ZOOM',
    // SL_SIMUL @5b32: shade strength 6/16, below the top control strip.
    shade: { box: [0, 45, 640, 435], opacity: 10 / 16 },
    label: 'Gros plan de l’éclipse', catalog: '/game/science-media/catalog.json',
  },
  instructions: 'Clique sur une graduation de l’horloge et sur une ville de la carte. Le centre de l’horloge permet aussi de choisir 11 h, absent des zones originales. Les caméras relancent les vues.',
  controls: {
    1: {
      mode: 'direct', panelBox: [65, 352, 66, 55],
      panelLabel: 'Choisir l’heure de 10 h à 11 h', heading: 'Heure de l’observation (TU)',
    },
    2: { mode: 'direct' },
    8: { mode: 'action', label: 'Rejouer le ciel vu de la Terre' },
    9: { mode: 'action', label: 'Rejouer la Terre vue depuis la Lune' },
  },
};
