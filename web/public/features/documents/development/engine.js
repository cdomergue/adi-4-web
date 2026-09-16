export { scenePoint, hitTest, matchesCase } from '../air/engine.js';
export { transitionSteps } from '../environment-animation.js';

// SIMUL08:270e, 2737, 2750. Integer division follows the original interpreter.
function calculate(values, element) {
  switch (element) {
    case 6:
      return Math.trunc((values[2] * (values[1] * values[3] + values[5])) / 6);
    case 7:
      return 3 - values[4];
    case 8:
      return Math.trunc((values[2] * values[5]) / 8);
    default:
      return values[element];
  }
}

function result(data, values) {
  const states = values.map((value, i) => data.values[i].indexOf(value));
  if (states.includes(-1)) throw new Error('Résultat absent des états graphiques.');
  return { inputs: states.slice(0, data.inputCount), states, values };
}

export function createInitial(data) {
  const values = Array(data.labels.length).fill(0);
  data.initialStates.forEach((state, i) => {
    values[i] = state < 0 ? calculate(values, i) : data.values[i][state];
  });
  return result(data, values);
}

export function availableOptions(data, state, element) {
  if (!Number.isInteger(element) || element < 0 || element >= data.inputCount) return [];
  let range;
  if (data.limitFlags[element]) {
    const [selector, , , , table] = data.limitSelectors[element];
    range = data.limits[table].find((row) => row[2] === state.values[selector]);
    if (!range) throw new Error('Limite absente des tables de développement.');
  }
  return data.values[element].map((value, index) => ({
    index,
    enabled: !range || (value >= range[0] && value <= range[1]),
  }));
}

export function changeInput(data, state, element, option) {
  if (
    !availableOptions(data, state, element).some((entry) => entry.index === option && entry.enabled)
  )
    return state;
  const values = [...state.values];
  values[element] = data.values[element][option];
  for (const affected of data.dependencies[element].slice(1))
    values[affected] = calculate(values, affected);
  // Limits disable future choices; SIMUL08:0794 does not clamp existing investments.
  return result(data, values);
}

export function reconstruct(data, state, example) {
  const { inputs } = example;
  if (
    !Array.isArray(inputs) ||
    inputs.length !== data.inputCount ||
    inputs.some(
      (value, i) => !Number.isInteger(value) || value < 0 || value >= data.values[i].length,
    )
  )
    throw new RangeError('Réglage invalide.');
  const values = [...state.values];
  for (let i = 0; i < data.labels.length; i++)
    values[i] = i < data.inputCount ? data.values[i][inputs[i]] : calculate(values, i);
  return result(data, values);
}

export { feedbackName } from '../environment-feedback.js';
