import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import {
  createInitial,
  reconstruct,
  changeInput,
  availableOptions,
  salesBand,
  transitionSteps,
  hitTest,
  scenePoint,
  matchesCase,
} from '../public/features/documents/company/engine.js';
import { spriteFrame } from '../public/features/documents/environment-animation.js';
const base = new URL('../public/game/documents/company/', import.meta.url);
const data = JSON.parse(await readFile(new URL('rules.json', base)));
const assets = JSON.parse(await readFile(new URL('assets.json', base)));

test('Company initial values and three original case solutions', () => {
  const initial = createInitial(data);
  assert.deepEqual(initial.values, [3, 12, 1, 1, 1, 1, 1, 3, 3, 0]);
  assert.deepEqual(initial.states, [2, 4, 0, 0, 0, 1, 1, 2, 2, 0]);
  const expected = [
    [1, 12, 2, 3, 3, 1, 1, 1, 1, 2],
    [2, 12, 2, 4, 3, 1, 1, 2, 2, 2],
    [3, 3, 3, 2, 3, 12, 5, 3, 12, 11],
  ];
  data.cases.forEach((example, i) => {
    const state = reconstruct(data, initial, example);
    assert.deepEqual(state.values, expected[i]);
    assert.ok(matchesCase(state, example));
  });
  assert.throws(() => reconstruct(data, initial, { inputs: [0, 0, 0, 0] }), RangeError);
});

test('Sales retain raw values while animation and capacity follow the original bands', () => {
  for (const [minimum, maximum, expected] of data.salesBands) {
    assert.equal(salesBand(data, minimum), expected);
    assert.equal(salesBand(data, maximum), expected);
  }
  assert.throws(() => salesBand(data, 33), RangeError);
  const state = reconstruct(data, createInitial(data), { inputs: [2, 0, 3, 4, 2] });
  assert.equal(state.values[5], 32);
  assert.equal(state.states[5], 8);
  assert.equal(state.values[6], 8);
  assert.equal(state.states[9], 14);
});

test('Investment menus use both the available capacity and current investment', () => {
  const initial = createInitial(data);
  assert.deepEqual(
    availableOptions(data, initial, 2).map((o) => o.enabled),
    [true, true, false, false],
  );
  assert.deepEqual(
    availableOptions(data, initial, 3).map((o) => o.enabled),
    [true, true, false, false, false],
  );
  assert.deepEqual(
    availableOptions(data, initial, 4).map((o) => o.enabled),
    [true, true, false],
  );
  assert.equal(changeInput(data, initial, 2, 3), initial);
  const step = changeInput(data, initial, 2, 1);
  assert.equal(step.values[6], 1);
  assert.deepEqual(
    availableOptions(data, step, 2).map((o) => o.enabled),
    [true, true, true, false],
  );
  assert.deepEqual(initial.inputs, [2, 4, 0, 0, 0]);
});

test('All 900 input combinations and allowed actions have valid states, bounds and media', () => {
  const initial = createInitial(data);
  for (let e = 0; e < 3; e++)
    for (let c = 0; c < 5; c++)
      for (let p = 0; p < 4; p++)
        for (let a = 0; a < 5; a++)
          for (let r = 0; r < 3; r++) {
            const state = reconstruct(data, initial, { inputs: [e, c, p, a, r] });
            assert.ok(state.values[5] >= 1 && state.values[5] <= 32);
            state.states.forEach((n, i) => assert.ok(assets.objects[i][n], `${i}:${n}`));
            for (let i = 0; i < 5; i++)
              for (const option of availableOptions(data, state, i).filter((o) => o.enabled)) {
                const next = changeInput(data, state, i, option.index);
                next.states.forEach((n, j) => assert.ok(assets.objects[j][n], `${j}:${n}`));
                for (const step of transitionSteps(data, state, next, i))
                  assert.ok(
                    (step.reverse ? assets.reverseObjects : assets.objects)[step.element][
                      step.clip
                    ],
                  );
              }
          }
});

test('Changes animate dependencies in script order and research uses reverse sequences', () => {
  const initial = createInitial(data);
  const changed = changeInput(data, initial, 1, 1);
  assert.deepEqual(
    transitionSteps(data, initial, changed, 1).map((s) => s.element),
    [1, 9, 8, 5, 6],
  );
  const high = reconstruct(data, initial, { inputs: [2, 0, 3, 4, 2] });
  const low = changeInput(data, high, 4, 0);
  assert.deepEqual(transitionSteps(data, high, low, 4).slice(0, 2), [
    { element: 4, state: 1, clip: 2, reverse: true },
    { element: 4, state: 0, clip: 1, reverse: true },
  ]);
});

test('Five landscape controls stay clickable at scaled coordinates', () => {
  const rect = { left: 40, top: 100, width: 320, height: 240 };
  for (const [i, [x, y]] of [
    [0, [300, 100]],
    [1, [140, 125]],
    [2, [400, 200]],
    [3, [220, 200]],
    [4, [550, 270]],
  ]) {
    const point = scenePoint(rect, rect.left + x / 2, rect.top + y / 2);
    assert.equal(hitTest(data, point.x, point.y), i);
  }
  assert.equal(hitTest(data, 639, 479), null);
  assert.deepEqual(
    data.markers[9],
    [0, 0, 0, 0],
    'market share must not cover the competition control',
  );
});

test('Original company sounds and paged explanation sheets ship with the client', async () => {
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
  for (const name of data.effectNames.flat().filter((n) => n !== 'SILENCE'))
    assert.ok(assets.audioEffects[name]?.audio);
  assert.equal(Object.keys(assets.explanations).length, 4);
  assert.equal(Object.keys(assets.caseAudio).length, 3);
  assert.ok(assets.voice.S12_VO.audio);
  assert.ok(assets.ambience.A_MUS12.audio);
  const long = assets.explanations.S12_RE01;
  assert.ok(Array.isArray(long.src));
  assert.deepEqual(spriteFrame(long, long.framesPerSheet), { src: long.src[1], y: 0 });
});
