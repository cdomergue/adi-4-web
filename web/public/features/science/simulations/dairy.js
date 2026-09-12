export default {
  id: '1',
  instructions: 'Clique sur les trois cuves pour choisir le caillage, l’égouttage et l’affinage. Actionne ensuite le levier électrique.',
  controls: {
    1: { mode: 'panel', heading: 'Caillage du lait' },
    2: { mode: 'panel', heading: 'Égouttage du caillé' },
    3: { mode: 'panel', heading: 'Affinage du fromage' },
    9: { mode: 'toggle', label: 'Actionner le levier : marche / arrêt' },
  },
};
