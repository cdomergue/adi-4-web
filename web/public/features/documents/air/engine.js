// S16 uses integer values from S16.DTA, which differ from the visible option indices.
function lookup(data, table, ...keys) {
  const row = data.lookups[table].find((r) => keys.every((key, i) => r[i + 1] === key));
  if (!row) throw new Error('Combinaison absente des tables de la simulation.');
  return row[0];
}

export function evaluate(data, inputs) {
  if (inputs.length !== 4 || inputs.some((n, i) => !Number.isInteger(n) || !data.values[i]?.[n]))
    throw new RangeError('Réglage invalide.');
  const values = inputs.map((n, i) => data.values[i][n]);
  // SIMUL16:0846, table 0: propulsion may require a different power station.
  values[2] = lookup(data, 0, values[2], values[3]);
  // SIMUL16:21fa (case 16, element 4), integer division before multiplication.
  values[4] = Math.trunc((values[3] + values[1] + values[2]) / 2) * values[0];
  values[5] = lookup(data, 2, values[4]);
  values[6] = lookup(data, 3, values[4]);
  values[7] = lookup(data, 1, values[2]);
  const states = values.map((value, i) => data.values[i].indexOf(value));
  if (states.includes(-1)) throw new Error('Résultat absent des états graphiques.');
  return { inputs: states.slice(0, 4), states, values };
}

export function availableOptions(data, state, element) {
  if (element < 0 || element > 3) return [];
  const other = element === 2 ? 3 : element === 3 ? 2 : null;
  const range =
    other === null ? null : data.limits[element - 2].find((r) => r[2] === state.values[other]);
  return data.values[element].map((value, index) => ({
    index,
    enabled: !range || (value >= range[0] && value <= range[1]),
  }));
}

export function changeInput(data, state, element, option) {
  if (!availableOptions(data, state, element).some((o) => o.index === option && o.enabled))
    return state;
  const inputs = [...state.inputs];
  inputs[element] = option;
  return evaluate(data, inputs);
}

export function transitionSteps(data, previous, next, changed = null) {
  const order = changed === null ? [0, 1, 2, 3, 7, 4, 6, 5] : data.dependencies[changed];
  const steps = [];
  for (const element of order) {
    const from = previous.states[element],
      to = next.states[element];
    if (from === to) continue;
    if ([0, 3, 6].includes(element)) {
      const direction = Math.sign(to - from);
      for (let state = from; state !== to; state += direction)
        steps.push({
          element,
          state: state + direction,
          clip: direction > 0 ? state + 1 : state,
          reverse: direction < 0,
        });
    } else steps.push({ element, state: to, clip: to, reverse: false });
  }
  return steps;
}

export function matchesCase(state, example) {
  return example.inputs.every((value, i) => state.inputs[i] === value);
}

export function scenePoint(rect, clientX, clientY) {
  return {
    x: ((clientX - rect.left) * 640) / rect.width,
    y: ((clientY - rect.top) * 480) / rect.height,
  };
}

export function hitTest(data, x, y) {
  if (x < 0 || y < 0 || x >= 640 || y >= 480) return null;
  // MAJSIMU's small control markers remain reachable outside the object rectangles.
  for (let i = 0; i < data.markers.length; i++) {
    const [left, top, width, height] = data.markers[i];
    if (x >= left && x < left + width && y >= top && y < top + height) return i;
  }
  for (let i = data.hitboxes.length - 1; i >= 0; i--) {
    const [left, top, width, height] = data.hitboxes[i];
    if (x >= left && x < left + width && y >= top && y < top + height) return i;
  }
  return null;
}
