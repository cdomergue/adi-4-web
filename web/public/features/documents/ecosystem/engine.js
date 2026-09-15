export { scenePoint, hitTest, matchesCase } from '../air/engine.js';

// SIMUL07:0f8f performs 20 integer Newton iterations at a scale of 100.
export function populationRoot(value) {
  if (value === 0) return 0;
  let root = 400;
  for (let i = 0; i < 20; i++) root = Math.trunc((Math.trunc((value * 10000) / root) + root) / 2);
  return Math.trunc(root / 100);
}

function calculate(data, values, element) {
  switch (element) {
    case 4:
      return 4 - values[0];
    case 5:
      return Math.min(
        4,
        Math.trunc((populationRoot(values[4] * (8 - values[6])) * values[1] * values[3]) / 100),
      );
    case 6:
      return Math.trunc((values[5] * values[2] * values[3]) / 100);
    case 7:
      return Math.trunc((values[5] + values[6]) / 2);
    case 8:
      return data.lookups[0].find((row) => row[1] === values[5])[0];
    case 9:
      return data.lookups[1].find((row) => row[1] === values[5] && row[2] === values[6])[0];
    default:
      return values[element];
  }
}

function result(data, values) {
  const states = values.map((value, i) => data.values[i].indexOf(value));
  if (states.includes(-1)) throw new Error('Résultat absent des états graphiques.');
  return { inputs: states.slice(0, 4), states, values };
}

function validateInputs(data, inputs) {
  if (
    !Array.isArray(inputs) ||
    inputs.length !== 4 ||
    inputs.some(
      (value, i) => !Number.isInteger(value) || value < 0 || value >= data.values[i].length,
    )
  )
    throw new RangeError('Réglage invalide.');
}

export function createInitial(data) {
  // MAJSIMU:0ab7 supplies four rabbits; MOTEUR:6d18 evaluates other outputs in order.
  const values = Array(10).fill(0);
  data.initialStates.forEach((state, i) => {
    values[i] = state < 0 ? calculate(data, values, i) : data.values[i][state];
  });
  return result(data, values);
}

export function availableOptions(data, state, element) {
  if (!Number.isInteger(element) || element < 0 || element >= 4) return [];
  const range = element === 1 ? data.limits.find((row) => row[2] === state.values[2]) : null;
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
  // One pass per action, not a fixed point: rabbits use the previous fox population.
  for (const affected of data.dependencies[element].slice(1))
    values[affected] = calculate(data, values, affected);
  return result(data, values);
}

export function reconstruct(data, state, example) {
  validateInputs(data, example.inputs);
  const values = [...state.values];
  for (let i = 0; i < 10; i++)
    values[i] = i < 4 ? data.values[i][example.inputs[i]] : calculate(data, values, i);
  return result(data, values);
}

export function transitionSteps(data, previous, next, changed = null) {
  const order = changed === null ? data.labels.map((_, i) => i) : data.dependencies[changed];
  const steps = [];
  for (const element of order) {
    const from = previous.states[element],
      to = next.states[element];
    if (data.sequential[element]) {
      const direction = Math.sign(to - from);
      for (let state = from; state !== to; state += direction)
        steps.push({
          element,
          state: state + direction,
          clip: direction > 0 ? state + 1 : state,
          reverse: direction < 0,
        });
    } else if (from !== to || element === changed)
      steps.push({ element, state: to, clip: to, reverse: false });
  }
  return steps;
}
