import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { experiments } from '../public/features/science/simulations/index.js';
import {
  activeControls, caseData, clipBox, sceneTargets, targetState,
} from '../public/features/science/interaction-model.js';
import { calculateSimulation } from '../public/features/science/simulation-engine.js';

const read = (id) => JSON.parse(readFileSync(
  new URL(`../public/game/station/sim-${id}.json`, import.meta.url)));

test('all 14 experiments offer every setting without opening the dropdowns', () => {
  assert.equal(Object.keys(experiments).length, 14);
  for (const [id, definition] of Object.entries(experiments)) {
    const data = read(id);
    for (const currentCase of data.cases) {
      const targets = sceneTargets(data, definition, currentCase);
      const controls = activeControls(data, definition, currentCase);
      for (const object of controls) {
        const config = definition.controls[object.id];
        const objectTargets = targets.filter((target) => target.object === object.id);
        assert.ok(objectTargets.length, `${id}/${object.id}: missing scene control`);
        for (const option of object.options) {
          assert.ok(objectTargets.some((target) =>
            ['panel', 'toggle'].includes(target.action) || target.state === option.id) ||
            config.clearState === option.id ||
            (config.mode === 'action' && option.id === 1),
          `${id}/${object.id}/${option.id}: dropdown-only setting`);
        }
      }
      for (const target of targets) {
        assert.deepEqual(clipBox(target.box), target.box);
        const [x, y, w, h] = target.box;
        // Another input must never intercept the CENTER of a native target.
        const interceptors = targets.filter((other) => {
          if (other === target) return false;
          const [a, b, c, d] = other.box;
          return x + w / 2 > a && x + w / 2 < a + c && y + h / 2 > b && y + h / 2 < b + d;
        });
        assert.equal(interceptors.length, 0, `${id}: occluded target ${JSON.stringify(target)}`);
      }
    }
  }
});

test('native sentinels are excluded and the lightning mast is clipped by two pixels', () => {
  assert.equal(clipBox([-1, -1, -1, -1]), null);
  assert.equal(clipBox([10, 10, 0, 10]), null);
  assert.deepEqual(clipBox([312, 404, 28, 78]), [312, 404, 28, 76]);
  const data = read('3');
  assert.deepEqual(sceneTargets(data, experiments['3'], data.cases[0])
    .find((target) => target.object === '5' && target.state === 2).box, [312, 404, 28, 76]);
});

test('atmosphere switches its overlapping gas controls and physical values with each case', () => {
  const data = read('12');
  const definition = experiments['12'];
  assert.deepEqual(activeControls(data, definition, data.cases[0]).map((object) => object.id),
    ['1', '2', '3', '4', '5', '6']);
  for (const currentCase of data.cases.slice(1)) {
    assert.deepEqual(activeControls(data, definition, currentCase).map((object) => object.id),
      ['5', '6', '15', '16', '17', '18']);
  }
  assert.equal(caseData(data, data.cases[1]).objects.find((object) => object.id === '1')
    .options[0].value, 30);
  assert.equal(data.objects.find((object) => object.id === '1').options[0].value, -1);
});

test('the dairy lever toggles in both directions and GO remains repeatable', () => {
  const data = read('1');
  const target = sceneTargets(data, experiments['1'], data.cases[0])
    .find((target) => target.object === '9');
  const object = data.objects.find((object) => object.id === '9');
  assert.equal(targetState(target, object, { 9: 1 }), 2);
  assert.equal(targetState(target, object, { 9: 2 }), 1);
  const go = { action: 'action', state: 2 };
  assert.equal(targetState(go, object, { 9: 1 }), 2);
  assert.equal(targetState(go, object, { 9: 2 }), 2);
});

test('the reproductive simulation synchronizes the cycle when the pill is selected', () => {
  const data = read('14');
  const result = calculateSimulation(data, { ...data.cases[0].initial, 1: 5, 5: 3 });
  assert.equal(result.states['1'], 3); // 28 days, even if the user selected 32 days.
});

test('every direct choice remains accepted by its case calculation, including the dedicated serre', () => {
  for (const [id, definition] of Object.entries(experiments)) {
    const data = read(id);
    for (const currentCase of data.cases) {
      const contextual = caseData(data, currentCase);
      for (const object of activeControls(contextual, definition, currentCase)) {
        for (const option of object.options) {
          const selected = { ...currentCase.initial, [object.id]: option.id };
          const result = (definition.calculate || calculateSimulation)(contextual, selected);
          for (const control of activeControls(contextual, definition, currentCase)) {
            assert.ok(control.options.some((entry) => entry.id === result.states[control.id]),
              `${id}/${currentCase.id}: invalid state for ${control.id}`);
          }
        }
      }
    }
  }
});
