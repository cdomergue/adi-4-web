import { createDairyPlayer } from './dairy-player.js';

export default {
  id: '1',
  instructions: 'Règle les trois cuves, puis actionne Power. Suis le lait pendant le caillage, l’égouttage et l’affinage, jusqu’à l’assiette de la souris.',
  createPlayback: createDairyPlayer,
  controls: {
    1: { mode: 'panel', heading: 'Caillage du lait' },
    2: { mode: 'panel', heading: 'Égouttage du caillé' },
    3: { mode: 'panel', heading: 'Affinage du fromage' },
    9: { mode: 'toggle', label: 'Actionner le levier : marche / arrêt' },
  },
};
