import { calculateSimulation, checkChallenge } from './simulation-engine.js';
import { caseData, isOptionAllowed, stateRestriction } from './interaction-model.js';

// Event state is separate from both formula evaluation and media playback.
// SEQS selects a single ordered calculation pass; reset displays ETATINI, not
// a speculative calculation of observations belonging to a future GO.
export function createSimulationState(source, currentCase) {
  const data = caseData(source, currentCase);
  let states = { ...currentCase.initial }, memory = {}, progress = {}, action = null;
  const snapshots = () => calculateSimulation(data, states, { sequence: [], memory });

  function challenge() {
    if (data.caseId === '0') return { success: false, progress: 0, total: 0 };
    const solutions = currentCase.solutions.map((solution, index) => {
      const paths = data.native?.cases[data.caseId]?.paths[String(index + 1)] || {};
      const expected = Object.fromEntries(Object.entries(solution).filter(([id, value]) => {
        const object = data.objects.find((o) => o.id === id);
        return [2, 4].includes(object?.type) && !data.hidden.includes(id) && value !== -1;
      }));
      const ordinary = Object.keys(expected).length ? checkChallenge([expected], states) : true;
      const entries = Object.entries(paths);
      const complete = entries.every(([id, path]) => progress[`${index + 1}:${id}`] === path.length);
      return { success: ordinary && complete && (Object.keys(expected).length > 0 || entries.length > 0),
        progress: entries.reduce((n, [id]) => n + (progress[`${index + 1}:${id}`] || 0), 0),
        total: entries.reduce((n, [, path]) => n + path.length, 0) };
    });
    return solutions.find((s) => s.success) || solutions.sort((a, b) => b.progress - a.progress)[0] ||
      { success: false, progress: 0, total: 0 };
  }

  function change(id, state) {
    if (action) return { accepted: false, reason: 'busy' };
    if (!isOptionAllowed(data, id, state, states)) {
      return { accepted: false, reason: 'restricted', restriction: stateRestriction(data, id, state, states) };
    }
    const object = data.objects.find((o) => o.id === id), before = { ...states };
    const repeatPath = data.id === '7' && id === '2';
    if (states[id] === state && !repeatPath) {
      return { accepted: true, before, after: { ...states }, sequence: [], trigger: id };
    }
    states[id] = state;
    const sequence = data.native?.sequences[id] || [];
    const result = calculateSimulation(data, states, { sequence, memory });
    states = result.states;
    for (const [solution, paths] of Object.entries(data.native?.cases[data.caseId]?.paths || {})) {
      for (const [owner, path] of Object.entries(paths)) {
        const key = `${solution}:${owner}`, cursor = progress[key] || 0;
        progress[key] = owner === id && states[id] === path[cursor] ? cursor + 1 : 0;
      }
    }
    if (object.type === 3) action = id;
    return { accepted: true, trigger: id, before, after: { ...states }, sequence: [...sequence],
      action: object.type === 3, challenge: challenge() };
  }

  function finish() {
    if (action) states[action] = 1; // SL_SIMUL RunGoButton @41d9.
    action = null;
    // The reaction can invalidate a previously selected treatment.
    if (data.id === '15' && stateRestriction(data, '3', states['3'], states)) states['3'] = 1;
    return snapshots();
  }

  function reset() {
    states = { ...currentCase.initial };
    memory = {};
    progress = {};
    action = null;
    return snapshots();
  }

  return { data, change, finish, reset, challenge, snapshot: snapshots };
}
