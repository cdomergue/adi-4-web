import { renderEnvironment } from '../environment-view.js';
import * as engine from './engine.js';

export function renderWater(main) {
  return renderEnvironment(main, {
    folder: 'water',
    program: 'S17',
    title: 'La pollution de l’eau',
    ambience: 'A_MUS17',
    sceneDescription:
      'Ville, industries, station d’épuration, agriculture, plage, pétrolier et mer',
    help: 'Clique sur la ville, les industries, la station d’épuration, le drapeau, les cultures, la plage ou le pétrolier pour modifier un réglage.',
    relationsLabel: 'Rejouer les sources de pollution',
    relationsHelp:
      'Les animations montrent comment les déchets, les eaux usées et les hydrocarbures rejoignent la mer.',
    idleRest: { 1: 7000, 2: 7000, 4: 7000, 5: 7000, 6: 7000, 7: 7000, 8: 7000, 9: 7000 },
    summary: (data, state) =>
      `${data.options[7][state.states[7]]}. ${data.options[8][state.states[8]]}. ${data.options[9][state.states[9]]}.`,
    engine,
  });
}
