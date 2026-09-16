import { renderEnvironment } from '../environment-view.js';
import * as engine from './engine.js';

export function renderDesert(main) {
  return renderEnvironment(main, {
    folder: 'desert',
    program: 'S14',
    title: 'La désertification',
    ambience: 'A_MUS14',
    sceneDescription: 'Village, marché, réseau électrique, cultures, puits et savane',
    help: 'Clique sur les habitations, les poteaux électriques ou les puits pour modifier la population, l’électricité ou l’irrigation.',
    relationsLabel: 'Rejouer les causes de la désertification',
    relationsHelp:
      'Les animations montrent les liens entre les besoins des habitants, le bois, les cultures et les réserves d’eau.',
    summary: (data, state) =>
      [4, 6, 7, 8].map((i) => data.options[i][state.states[i]]).join('. ') + '.',
    confirmChoices: true,
    engine,
  });
}
