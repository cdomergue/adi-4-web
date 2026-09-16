import { renderEnvironment } from '../environment-view.js';
import * as engine from './engine.js';

export function renderEcosystem(main) {
  return renderEnvironment(main, {
    folder: 'ecosystem',
    program: 'S07',
    title: 'L’équilibre de la nature',
    ambience: 'A_MUS07',
    sceneDescription: 'Paysage, lapins, renards, cultures et activités humaines',
    help: 'Clique sur la pollution, le chasseur, le vétérinaire ou le tracteur pour modifier un réglage.',
    summary: (data, state) =>
      `Lapins : ${data.options[5][state.states[5]].toLowerCase()}. Renards : ${data.options[6][state.states[6]].toLowerCase()}. ${data.options[9][state.states[9]]}.`,
    confirmChoices: true,
    engine,
  });
}
