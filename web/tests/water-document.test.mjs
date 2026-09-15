import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import {
  evaluate,
  createInitial,
  reconstruct,
  changeInput,
  availableOptions,
  transitionSteps,
  scenePoint,
  hitTest,
  matchesCase,
} from '../public/features/documents/water/engine.js';
import { spriteFrame } from '../public/features/documents/environment-animation.js';
const base = new URL('../public/game/documents/water/', import.meta.url);
const data = JSON.parse(await readFile(new URL('rules.json', base)));
const assets = JSON.parse(await readFile(new URL('assets.json', base)));

test('Water pollution initial state and three original case solutions', () => {
  const initial = createInitial(data);
  assert.deepEqual(initial.values, [1, 1, 1, 1, 1, 1, 1, 2, 2, 3]);
  const expected = [
    [2, 2, 1, 1, 2, 2, 2, 4, 4, 4],
    [1, 2, 0, 2, 2, 0, 0, 1, 0, 1],
    [0, 0, 1, 1, 0, 1, 1, 0, 1, 1],
  ];
  data.cases.forEach((example, i) => {
    const state = reconstruct(data, initial, example);
    assert.deepEqual(state.values, expected[i]);
    assert.ok(matchesCase(state, example));
  });
  assert.throws(() => evaluate(data, [0, 0, 0, 0]), RangeError);
  assert.throws(() => evaluate(data, [0, 0, 0, 0, 0, 0, 3]), RangeError);
});

test('Sewage exception, separate integer divisions and original sea cap', () => {
  const rural = evaluate(data, [0, 0, 0, 0, 0, 0, 0]);
  assert.equal(rural.values[8], 1, 'untreated rural water is not automatically clear');
  const treated = changeInput(data, rural, 2, 1);
  assert.equal(treated.values[8], 0);
  const divisions = evaluate(data, [1, 0, 0, 0, 0, 1, 0]);
  assert.equal(divisions.values[9], 0, 'floor(2/3) + floor(1/2), not floor(2/3 + 1/2)');
  const maximum = evaluate(data, [2, 2, 0, 0, 2, 2, 2]);
  assert.equal(maximum.rawSeaPollution, 6);
  assert.equal(maximum.values[9], 4);
  assert.equal(maximum.states[9], 4);
});

test('MAJSIMU allows all seven inputs, including treatment with low urban activity', () => {
  assert.deepEqual(data.limitFlags, Array(10).fill(0));
  const rural = evaluate(data, [0, 0, 0, 0, 0, 0, 0]);
  for (let i = 0; i < 7; i++) assert.ok(availableOptions(data, rural, i).every((o) => o.enabled));
  assert.deepEqual(
    availableOptions(data, rural, 2).map((o) => o.index),
    [0, 1],
  );
  assert.equal(changeInput(data, rural, 2, 9), rural);
  assert.equal(changeInput(data, rural, 9, 0), rural);
});

test('All 972 combinations and every permitted action resolve to bundled animations', () => {
  let count = 0;
  function visit(inputs) {
    if (inputs.length < 7) {
      for (let n = 0; n < data.values[inputs.length].length; n++) visit([...inputs, n]);
      return;
    }
    count++;
    const state = evaluate(data, inputs);
    assert.ok(state.values[9] >= 0 && state.values[9] <= 4);
    state.states.forEach((n, i) => assert.ok(assets.objects[i][n], `${i}:${n}`));
    for (let i = 0; i < 7; i++)
      for (const option of availableOptions(data, state, i)) {
        const next = changeInput(data, state, i, option.index);
        for (const step of transitionSteps(data, state, next, i))
          assert.ok(
            (step.reverse ? assets.reverseObjects : assets.objects)[step.element][step.clip],
          );
      }
  }
  visit([]);
  assert.equal(count, 972);
});

test('City, treatment and policy use their distinct propagation paths', () => {
  const initial = createInitial(data);
  const city = changeInput(data, initial, 0, 2);
  assert.deepEqual(
    [...new Set(transitionSteps(data, initial, city, 0).map((s) => s.element))],
    [0, 7, 8],
  );
  assert.equal(city.values[9], initial.values[9], 'rounded sea level stays unchanged');
  const treated = changeInput(data, initial, 2, 1);
  assert.deepEqual(
    [...new Set(transitionSteps(data, initial, treated, 2).map((s) => s.element))],
    [2, 8, 9],
  );
  assert.equal(treated.values[7], initial.values[7]);
  const policy = changeInput(data, initial, 3, 1);
  assert.equal(policy.values[7], 1);
  assert.equal(policy.values[8], 2);
  assert.deepEqual(initial.inputs, [1, 1, 0, 0, 1, 1, 1]);
});

test('Seven scene controls and both sea markers work at half scale', () => {
  const rect = { left: 40, top: 80, width: 320, height: 240 };
  for (const [element, [x, y]] of [
    [0, [100, 50]],
    [1, [270, 70]],
    [2, [160, 130]],
    [3, [400, 40]],
    [4, [530, 110]],
    [5, [90, 230]],
    [6, [440, 360]],
    [9, [50, 370]],
    [9, [500, 230]],
  ]) {
    const point = scenePoint(rect, rect.left + x / 2, rect.top + y / 2);
    assert.equal(hitTest(data, point.x, point.y), element);
  }
  assert.equal(hitTest(data, -1, 90), null);
});

test('Water media include the foreground ship, seven explanations and all choice sounds', async () => {
  const paths = new Set();
  function collect(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (['src', 'colorSrc', 'audio', 'palette'].includes(key))
        for (const path of Array.isArray(item) ? item : [item]) paths.add(path);
      else collect(item);
    }
  }
  collect(assets);
  for (const path of paths) await access(new URL(path, base));
  assert.ok(assets.foregroundObjects.S17_0OP.src);
  assert.deepEqual(assets.foregroundObjects.S17_0OP.origin, [334, 272]);
  assert.equal(Object.keys(assets.explanations).length, 7);
  assert.equal(Object.keys(assets.ambientReactions).length, 6);
  for (const name of data.effectNames.flat().filter((n) => n !== 'SILENCE'))
    assert.ok(assets.audioEffects[name]?.audio, name);
  for (const clip of Object.values(assets.explanations).filter((clip) => Array.isArray(clip.src)))
    assert.deepEqual(spriteFrame(clip, clip.framesPerSheet), { src: clip.src[1], y: 0 });
});
