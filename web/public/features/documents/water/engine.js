import { hitTest as environmentHitTest } from '../air/engine.js';
export { scenePoint, matchesCase } from '../air/engine.js';
export { transitionSteps } from '../environment-animation.js';

export function evaluate(data, inputs) {
  if (
    !Array.isArray(inputs) ||
    inputs.length !== data.inputCount ||
    inputs.some(
      (value, i) => !Number.isInteger(value) || value < 0 || value >= data.values[i].length,
    )
  )
    throw new RangeError('Réglage invalide.');
  const values = inputs.map((index, i) => data.values[i][index]);
  // SIMUL17:299f. Integer divisions are performed independently before addition.
  values[7] = Math.trunc((values[0] + values[1]) / values[3]);
  values[8] = (values[0] + values[1]) * values[2];
  if (values[0] === 0 && values[1] === 0 && values[2] === 1) values[8] = 1;
  const rawSeaPollution =
    Math.trunc((values[8] + values[7] + 2 * values[4]) / 3) +
    Math.trunc((values[5] + values[6]) / 2);
  // SIMUL17:2a50 explicitly caps this value; S17_9I/D only exist for states0..4.
  values[9] = Math.min(4, rawSeaPollution);
  const states = values.map((value, i) => data.values[i].indexOf(value));
  if (states.includes(-1)) throw new Error('Résultat absent des états graphiques.');
  return { inputs: [...inputs], states, values, rawSeaPollution };
}

export function createInitial(data) {
  return evaluate(data, data.initialStates.slice(0, data.inputCount));
}

export function availableOptions(data, state, element) {
  if (!Number.isInteger(element) || element < 0 || element >= data.inputCount) return [];
  // MAJSIMU:29d3 disables the old DTA restriction on water treatment.
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

export function hitTest(data, x, y) {
  for (const {
    element,
    box: [left, top, width, height],
  } of data.extraMarkers || [])
    if (x >= left && x < left + width && y >= top && y < top + height) return element;
  return environmentHitTest(data, x, y);
}
