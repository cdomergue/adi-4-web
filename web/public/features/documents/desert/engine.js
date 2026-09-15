export { scenePoint, hitTest, matchesCase } from '../air/engine.js';
export { transitionSteps } from '../environment-animation.js';

function lookup(data, table, first, second) {
  const row = data.lookups[table].find((row) => row[1] === first && row[2] === second);
  if (!row) throw new Error('Combinaison absente des tables de la désertification.');
  return row[0];
}

export function evaluate(data, inputs) {
  if (
    !Array.isArray(inputs) ||
    inputs.length !== 3 ||
    inputs.some(
      (value, i) => !Number.isInteger(value) || value < 0 || value >= data.values[i].length,
    )
  )
    throw new RangeError('Réglage invalide.');
  const values = inputs.map((index, i) => data.values[i][index]);
  // S14.DTA: table 0 (population, electricity); table 1 (irrigation, crops).
  values[3] = lookup(data, 0, values[0], values[1]);
  // SIMUL14:272b copies wood use, population, crops and groundwater respectively.
  values[4] = values[3];
  values[5] = values[0];
  values[6] = values[5];
  values[7] = lookup(data, 1, values[2], values[5]);
  values[8] = values[7];
  const states = values.map((value, i) => data.values[i].indexOf(value));
  if (states.includes(-1)) throw new Error('Résultat absent des états graphiques.');
  return { inputs: [...inputs], values, states };
}

export function createInitial(data) {
  return evaluate(data, data.initialStates.slice(0, 3));
}

export function availableOptions(data, state, element) {
  if (!Number.isInteger(element) || element < 0 || element >= 3) return [];
  return data.values[element].map((_, index) => ({ index, enabled: true }));
}

export function changeInput(data, state, element, option) {
  if (!availableOptions(data, state, element).some((entry) => entry.index === option)) return state;
  const inputs = [...state.inputs];
  inputs[element] = option;
  return evaluate(data, inputs);
}

export function reconstruct(data, state, example) {
  return evaluate(data, example.inputs);
}
