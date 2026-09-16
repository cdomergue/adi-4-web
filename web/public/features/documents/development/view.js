import { renderEnvironment } from '../environment-view.js';
import * as engine from './engine.js';

export function renderDevelopment(main) {
  return renderEnvironment(main, {
    folder: 'development',
    program: 'S08',
    title: 'Le développement d’un pays',
    ambience: 'A_MUS08',
    sceneDescription:
      'Climat, agriculture, régime politique, marchés, école, hôpital et industries',
    help: 'Clique sur l’arbre, les cultures, le dirigeant, la bourse, l’école ou les usines pour modifier les conditions du pays.',
    relationsLabel: 'Rejouer les relations du développement',
    relationsHelp:
      'Les animations expliquent les liens entre l’agriculture, le budget, les investissements, la fécondité et la stabilité politique.',
    summary: (data, state) =>
      [6, 7, 8].map((i) => `${data.labels[i]} : ${data.options[i][state.states[i]]}`).join('. ') +
      '.',
    confirmChoices: true,
    engine,
  });
}
