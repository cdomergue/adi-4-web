import { renderEnvironment } from '../environment-view.js';
import * as engine from './engine.js';

export function renderAir(main) {
  return renderEnvironment(main, {
    folder: 'air',
    program: 'S16',
    title: 'La pollution de l’air',
    ambience: 'A_MUS16',
    sceneDescription: 'Ville, industries, centrale et moyens de transport',
    help: 'Clique sur le relief, les industries, la centrale ou les voitures pour modifier un réglage.',
    summary: (data, state) =>
      `${data.options[4][state.states[4]]}. Santé des hommes : ${data.options[5][state.states[5]].toLowerCase()}.`,
    confirmChoices: true,
    engine: {
      ...engine,
      createInitial: (data) => engine.evaluate(data, data.defaultInputs),
      reconstruct: (data, state, example) => engine.evaluate(data, example.inputs),
    },
  });
}
