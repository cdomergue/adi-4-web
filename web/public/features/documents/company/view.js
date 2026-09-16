import { renderEnvironment } from '../environment-view.js';
import * as engine from './engine.js';

export function renderCompany(main) {
  return renderEnvironment(main, {
    folder: 'company',
    program: 'S12',
    title: 'L’entreprise',
    ambience: 'A_MUS12',
    sceneDescription: 'Entreprise, banque, publicité, production, recherche, clientèle et ventes',
    help: 'Clique sur la banque, la concurrence, la production, la publicité ou le laboratoire pour modifier un réglage.',
    relationsLabel: 'Rejouer le fonctionnement de l’entreprise',
    relationsHelp:
      'Les animations expliquent les liens entre les investissements, les ventes et les consommateurs.',
    summary: (data, state) =>
      `${data.options[5][state.states[5]]}. Capacité d’investissement : ${data.options[6][state.states[6]].toLocaleLowerCase('fr')}. Part de marché : ${data.options[9][state.states[9]]}.`,
    confirmChoices: true,
    engine,
  });
}
