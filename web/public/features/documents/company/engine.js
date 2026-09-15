export { scenePoint, hitTest, matchesCase } from '../air/engine.js';

export function salesBand(data, value) {
  const band = data.salesBands.find(([minimum, maximum]) => value >= minimum && value <= maximum);
  if (!band) throw new RangeError('Ventes hors des tables du document.');
  return band[2];
}

function lookup(data, table, ...keys) {
  const row = data.lookups[table].find((entry) => keys.every((key, i) => entry[i + 1] === key));
  if (!row) throw new Error('Combinaison absente des tables de l’entreprise.');
  return row[0];
}

function calculate(data, values, element) {
  switch (element) {
    case 5:
      // SIMUL12:2705 keeps raw sales separately from their nine visual bands.
      return Math.max(1, values[2] * (values[3] + values[4]) - values[1] - 3 * (3 - values[0]));
    case 6:
      return salesBand(data, values[5]);
    case 7:
      return values[0];
    case 8:
      return lookup(data, 0, values[1], values[0]);
    case 9:
      return lookup(data, 1, values[1], values[4]);
    default:
      return values[element];
  }
}

function result(data, values) {
  const states = values.map((value, i) =>
    i === 5 ? salesBand(data, value) : data.values[i].indexOf(value),
  );
  if (states.includes(-1)) throw new Error('Résultat absent des états graphiques.');
  return { inputs: states.slice(0, data.inputCount), states, values };
}

function validateInputs(data, inputs) {
  if (
    !Array.isArray(inputs) ||
    inputs.length !== data.inputCount ||
    inputs.some(
      (value, i) => !Number.isInteger(value) || value < 0 || value >= data.values[i].length,
    )
  )
    throw new RangeError('Réglage invalide.');
}

export function createInitial(data) {
  const values = Array(data.labels.length).fill(0);
  data.initialStates.forEach((state, i) => {
    values[i] = state < 0 ? calculate(data, values, i) : data.values[i][state];
  });
  return result(data, values);
}

export function availableOptions(data, state, element) {
  if (!Number.isInteger(element) || element < 0 || element >= data.inputCount) return [];
  let range;
  if (element >= 2) {
    const [capacity, investment, , , table] = data.limitSelectors[element];
    range = data.limits[table].find(
      (row) => row[2] === state.values[capacity] && row[3] === state.values[investment],
    );
    if (!range) throw new Error('Limite d’investissement absente des tables.');
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
    values[affected] = calculate(data, values, affected);
  return result(data, values);
}

export function reconstruct(data, state, example) {
  validateInputs(data, example.inputs);
  const values = [...state.values];
  for (let i = 0; i < data.labels.length; i++)
    values[i] =
      i < data.inputCount ? data.values[i][example.inputs[i]] : calculate(data, values, i);
  return result(data, values);
}

export { transitionSteps } from '../environment-animation.js';
