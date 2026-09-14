import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import {
  evaluate,
  changeInput,
  availableOptions,
  transitionSteps,
  matchesCase,
  scenePoint,
  hitTest,
} from '../public/features/documents/air/engine.js';
const base = new URL('../public/game/documents/air/', import.meta.url);
const data = JSON.parse(await readFile(new URL('rules.json', base), 'utf8'));
const assets = JSON.parse(await readFile(new URL('assets.json', base), 'utf8'));

test('Air default city and three original cases produce the original DTA results', () => {
  assert.deepEqual(evaluate(data, data.defaultInputs).states, [0, 2, 3, 2, 4, 4, 4, 0]);
  const results = [
    [1, 2, 1, 2, 8, 1, 1, 1],
    [0, 1, 3, 2, 3, 3, 3, 0],
    [1, 0, 0, 1, 6, 0, 0, 0],
  ];
  data.cases.forEach((example, i) => {
    const state = evaluate(data, example.inputs);
    assert.deepEqual(state.states, results[i]);
    assert.ok(matchesCase(state, example));
  });
  assert.throws(() => evaluate(data, [0, 0, -1, 2]), RangeError);
});
test('All 72 input combinations have graphics, dependencies and bounded outputs', () => {
  for (let relief = 0; relief < 2; relief++)
    for (let factory = 0; factory < 3; factory++)
      for (let power = 0; power < 4; power++)
        for (let cars = 0; cars < 3; cars++) {
          const state = evaluate(data, [relief, factory, power, cars]);
          state.states.forEach((value, i) => assert.ok(assets.objects[i][value], `${i}:${value}`));
          assert.equal(state.states[5], state.states[6]);
          assert.equal(state.states[7], state.inputs[2] === 1 ? 1 : 0);
        }
});
test('Electric vehicles require enough power; invalid menu choices do not mutate state', () => {
  const mixed = evaluate(data, [1, 0, 0, 1]);
  assert.equal(availableOptions(data, mixed, 3)[0].enabled, false);
  assert.equal(changeInput(data, mixed, 3, 0), mixed);
  const electric = evaluate(data, [1, 0, 1, 0]);
  assert.equal(availableOptions(data, electric, 2)[0].enabled, false);
  assert.equal(changeInput(data, electric, 2, 0), electric);
  assert.deepEqual(evaluate(data, [1, 0, 0, 0]).inputs, [1, 0, 1, 0]);
});
test('Changes animate each dependent object in original order, including reverse steps', () => {
  const polluted = evaluate(data, [0, 2, 3, 2]),
    clean = evaluate(data, [1, 2, 3, 2]);
  assert.deepEqual(
    [...new Set(transitionSteps(data, polluted, clean, 0).map((s) => s.element))],
    [0, 4, 6, 5],
  );
  const reverse = transitionSteps(data, clean, polluted, 0);
  assert.deepEqual(reverse[0], { element: 0, state: 0, clip: 1, reverse: true });
  for (const step of [...transitionSteps(data, polluted, clean, 0), ...reverse]) {
    assert.ok((step.reverse ? assets.reverseObjects : assets.objects)[step.element][step.clip]);
  }
});
test('Original clickable zones retain precise coordinates at different display sizes', () => {
  const rect = { left: 100, top: 200, width: 960, height: 720 };
  const point = scenePoint(rect, 100 + 570 * 1.5, 200 + 150 * 1.5);
  assert.deepEqual(point, { x: 570, y: 150 });
  assert.equal(hitTest(data, point.x, point.y), 1);
  data.markers.forEach(([x, y, w, h], i) => assert.equal(hitTest(data, x + w / 2, y + h / 2), i));
  assert.equal(hitTest(data, 640, 50), null);
  assert.equal(hitTest(data, -1, 50), null);
  assert.equal(hitTest(data, 400, 460), null);
});
test('Every native image, animation and voice is bundled without an archive or emulator', async () => {
  const paths = new Set();
  function collect(value) {
    if (typeof value === 'string' && /\.(webp|png|wav|flac|json)$/.test(value)) paths.add(value);
    else if (value && typeof value === 'object') Object.values(value).forEach(collect);
  }
  collect(assets);
  for (const path of paths) await access(new URL(path, base));
  for (const group of [
    assets.objects,
    assets.reverseObjects,
    { idle: Object.values(assets.idleObjects) },
  ])
    for (const entries of Object.values(group))
      for (const clip of entries) {
        assert.equal(clip.origin.length, 2);
        assert.ok(clip.frames > 0);
        if (clip.frames > 1) assert.equal(clip.format, 'vertical-sprite-sheet');
      }
  assert.ok(assets.voice.S16_VO.audio);
  assert.ok(assets.ambience.A_MUS16.audio);
  for (const name of data.effectNames.flat()) assert.ok(assets.audioEffects[name]?.audio, name);
});
