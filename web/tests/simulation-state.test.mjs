import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSimulationState } from '../public/features/science/simulation-state.js';
import { calculateSimulation } from '../public/features/science/simulation-engine.js';
import { caseData, activeControls, isOptionAllowed } from '../public/features/science/interaction-model.js';
import { experiments } from '../public/features/science/simulations/index.js';

const read = (id) => JSON.parse(readFileSync(new URL(
  `../public/game/station/sim-${id}.json`, import.meta.url)));
const session = (id, situation = 0) => {
  const data = read(id);
  return createSimulationState(data, data.cases[situation]);
};

test('all three ant challenges validate the ordered path, not a sentinel state', () => {
  assert.equal(experiments['7'].isObservationVisible({id:'4'}), false);
  for (const [index, path] of [[7, 5, 6], [5, 6, 8], [7, 6, 8]].entries()) {
    const s = session('7', index + 1);
    assert.equal(s.challenge().success, false);
    for (const [step, state] of path.entries()) {
      assert.equal(s.change('2', state).accepted, true);
      s.finish();
      assert.equal(s.challenge().progress, step + 1);
    }
    const completed = s.snapshot();
    assert.equal(s.challenge().success, true);
    assert.equal(s.challenge().success, true); // Checking does not add another click.
    assert.deepEqual(s.snapshot(), completed);
    s.change('2', path.at(-1)); // Same place still counts as an incorrect next click.
    assert.equal(s.challenge().success, false);
    s.reset();
    s.change('2', path[0]); s.change('2', 1);
    assert.equal(s.challenge().progress, 0);
    assert.equal(s.change('1', 1).accepted, false); // Imposed season.
    assert.equal(s.change('3', 2).accepted, false); // Hidden camera.
  }
});

test('reset displays ETATINI and never runs future GO calculations', () => {
  for (const id of Object.keys(experiments).filter((id) => id !== '1')) {
    const data = read(id);
    for (const situation of data.cases) {
      const s = createSimulationState(data, situation);
      assert.deepEqual(s.snapshot().states, situation.initial, `${id}/${situation.id}`);
      assert.deepEqual(s.reset().states, situation.initial);
    }
  }
});

test('atmosphere calculation receives CASID and preserves numeric values independently of labels', () => {
  const source = read('12'), data = caseData(source, source.cases[3]);
  const result = calculateSimulation(data, source.cases[3].initial);
  assert.deepEqual(['7', '8', '9', '10'].map((id) => result.states[id]), [3, 2, 3, 3]);
  assert.deepEqual(['7', '8', '9', '10'].map((id) => result.values[id]), [2, 1, 2, 2]);
});

test('packaging waits for GO, computes SEQS once and returns GO to rest', () => {
  const s = session('5');
  s.change('2', 1); s.finish();
  assert.equal(s.snapshot().states['9'], 72);
  const event = s.change('18', 2);
  assert.deepEqual(event.sequence, ['12', '13', '14', '15', '16', '17', '8', '9', '10', '11']);
  assert.equal(s.snapshot().states['9'], 71);
  assert.equal(s.change('2', 2).reason, 'busy');
  assert.equal(s.finish().states['18'], 1);
  assert.equal(s.change('18', 2).accepted, true);
});

test('each eclipse camera computes only its own observation', () => {
  const s = session('13');
  assert.deepEqual(s.change('8', 2).sequence, ['11']);
  s.finish();
  assert.deepEqual(s.change('9', 2).sequence, ['12']);
  s.finish();
  assert.equal(s.snapshot().states['8'], 1);
  assert.equal(s.snapshot().states['9'], 1);
});

test('immunology revalidates treatment after a change of foreign body', () => {
  const s = session('15', 1);
  s.change('2', 2); s.finish();
  assert.equal(s.change('3', 6).accepted, true); s.finish();
  assert.equal(s.snapshot().states['3'], 6);
  s.change('1', 2);
  assert.equal(s.snapshot().states['3'], 6);
  assert.equal(s.finish().states['3'], 1);
});

test('a failed atmosphere table lookup does not preserve a previous developed life', () => {
  const source = read('12'), data = caseData(source, source.cases[2]);
  const previous = calculateSimulation(data, {
    ...source.cases[2].initial, 5: 2, 6: 2, 15: 1, 16: 1, 18: 1,
  });
  assert.equal(previous.values['8'], 2);
  const result = calculateSimulation(data, {
    ...previous.states, 5: 3, 6: 1, 15: 2, 16: 2, 18: 2,
  }, { sequence: ['7', '8', '9', '10', '11', '12', '13', '14'] });
  assert.equal(result.values['8'], 0);
});

test('native visibility and restrictions govern all entry points', () => {
  for (const [id, definition] of Object.entries(experiments).filter(([id]) => id !== '1')) {
    const source = read(id);
    for (const situation of source.cases) {
      const data = caseData(source, situation);
      const controls = activeControls(data, definition, situation);
      assert.ok(controls.every((o) => !situation.hidden.includes(o.id)));
      for (const object of source.objects.filter((o) => [2, 3, 4].includes(o.type))) {
        for (const option of object.options) {
          const s = createSimulationState(source, situation);
          assert.equal(s.change(object.id, option.id).accepted,
            isOptionAllowed(data, object.id, option.id, situation.initial),
            `${id}/${situation.id}/${object.id}/${option.id}`);
        }
      }
    }
  }
  const eclipse = session('13', 2);
  assert.equal(eclipse.change('2', 2).accepted, false); // Paris, London is imposed.
  const reproduction = session('14');
  assert.equal(reproduction.change('2', 13).accepted, false);
  reproduction.change('5', 3); reproduction.finish();
  assert.equal(reproduction.snapshot().states['1'], 3);
  assert.equal(reproduction.change('1', 5).accepted, false);
});
