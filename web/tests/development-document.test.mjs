import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import {
  createInitial,
  reconstruct,
  changeInput,
  availableOptions,
  transitionSteps,
  scenePoint,
  hitTest,
  matchesCase,
} from '../public/features/documents/development/engine.js';
import { createAtmosphere } from '../public/features/documents/development/animation.js';
const base = new URL('../public/game/documents/development/', import.meta.url);
const data = JSON.parse(await readFile(new URL('rules.json', base)));
const assets = JSON.parse(await readFile(new URL('assets.json', base)));
const initial = createInitial(data);

test('Development initial state and four original case solutions', () => {
  assert.deepEqual(initial.values, [0, 0, 0, 0, 0, 0, 0, 3, 0]);
  const expected = [
    [2, 1, 0, 0, 0, 0, 0, 3, 0],
    [0, 1, 3, 1, 1, 2, 1, 2, 0],
    [3, 4, 3, 1, 2, 5, 4, 1, 1],
    [3, 4, 3, 2, 3, 8, 8, 0, 3],
  ];
  data.cases.forEach((example, i) => {
    const next = reconstruct(data, initial, example);
    assert.deepEqual(next.values, expected[i]);
    assert.ok(matchesCase(next, example));
  });
  for (const inputs of [null, [], [0, 0, 0, 0, 0, 4], [0, 0, 0, 0, 0, -1], [0, 0, 0, 0, 0, 0.5]])
    assert.throws(() => reconstruct(data, initial, { inputs }), RangeError);
  assert.equal(changeInput(data, initial, 6, 1), initial);
});

test('Climate/agriculture limits are reciprocal and education uses industry values', () => {
  const enabled = (state, i) =>
    availableOptions(data, state, i)
      .filter((x) => x.enabled)
      .map((x) => x.index);
  assert.deepEqual(enabled(initial, 1), [0, 1]);
  assert.equal(changeInput(data, initial, 1, 4), initial);
  const favourable = changeInput(data, initial, 0, 3);
  const farming = changeInput(data, favourable, 1, 4);
  assert.deepEqual(enabled(farming, 0), [3, 4]);
  assert.equal(changeInput(data, farming, 0, 0), farming);
  assert.deepEqual(enabled(initial, 4), [0, 1]);
  assert.deepEqual(enabled(changeInput(data, initial, 5, 1), 4), [0, 1, 2]);
  assert.deepEqual(enabled(changeInput(data, initial, 5, 2), 4), [0, 1, 2, 3]);
  let state = reconstruct(data, initial, data.cases[3]);
  state = changeInput(data, state, 5, 0);
  assert.equal(state.values[4], 3, 'changing limits does not reset existing investment');
  assert.equal(state.values[7], 0);
  assert.deepEqual(enabled(state, 4), [0, 1]);
  assert.deepEqual(initial.values, [0, 0, 0, 0, 0, 0, 0, 3, 0]);
});

test('All 4800 input combinations have bounded outputs and every allowed transition has media', () => {
  let count = 0;
  for (let a = 0; a < 5; a++)
    for (let b = 0; b < 5; b++)
      for (let c = 0; c < 4; c++)
        for (let d = 0; d < 3; d++)
          for (let e = 0; e < 4; e++)
            for (let f = 0; f < 4; f++) {
              count++;
              const state = reconstruct(data, initial, { inputs: [a, b, c, d, e, f] });
              state.states.forEach((v, i) => assert.ok(assets.objects[i][v]));
              for (let i = 0; i < 6; i++)
                for (const option of availableOptions(data, state, i)) {
                  const next = changeInput(data, state, i, option.index);
                  if (!option.enabled) assert.equal(next, state);
                  for (const step of transitionSteps(data, state, next, i))
                    assert.ok(
                      (step.reverse ? assets.reverseObjects : assets.objects)[step.element][
                        step.clip
                      ],
                    );
                }
            }
  assert.equal(count, 4800);
});

test('The nine markers and the six landscape controls match original coordinates at any scale', () => {
  const rect = { left: 20, top: 40, width: 960, height: 720 };
  for (const [i, [x, y]] of [
    [0, [580, 80]],
    [1, [550, 390]],
    [2, [350, 250]],
    [3, [460, 110]],
    [4, [150, 410]],
    [5, [50, 240]],
  ]) {
    const point = scenePoint(rect, rect.left + x * 1.5, rect.top + y * 1.5);
    assert.equal(hitTest(data, point.x, point.y), i);
  }
  data.markers.forEach(([x, y, w, h], i) => assert.equal(hitTest(data, x + w / 2, y + h / 2), i));
  assert.equal(hitTest(data, 640, 480), null);
});

test('Ambient selection preserves the script’s silent slots, no-repeat rule and layer order', () => {
  for (let draw = 0; draw < 8; draw++) {
    const frame = createAtmosphere(assets, () => draw / 8).tick();
    if (draw <= 2) assert.equal(frame.ambient, null);
    else assert.equal(frame.ambient.resource, assets.ambientReactions[`S08_${8 - draw}H`]);
  }
  const sequence = [3 / 8, 3 / 8, 0, 7 / 8, 0];
  const clock = createAtmosphere(assets, () => sequence.shift() ?? 0);
  assert.equal(clock.tick().ambient.resource, assets.ambientReactions.S08_5H);
  let next;
  for (let i = 1; i <= 251; i++) next = clock.tick();
  assert.equal(next.ambient, null);
  for (let i = 252; i <= 502; i++) next = clock.tick();
  assert.equal(next.ambient.resource, assets.ambientReactions.S08_1H);
  assert.equal(next.ambient.frame, 0);
  assert.deepEqual(data.idleEnabled, [0, 0, 0, 0, 0, 1, 0, 0, 1]);
  assert.ok(data.priorities.ambient[5] < data.priorities.objects[1]);
});

test('All scene media, six explanations, choice sounds and original French texts are bundled', async () => {
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
  assert.equal(Object.keys(assets.explanations).length, 6);
  assert.ok(assets.voice.S08_VO.audio);
  assert.ok(assets.ambience.A_MUS08.audio);
  for (const name of data.effectNames.flat()) assert.ok(assets.audioEffects[name]?.audio, name);
  assert.match(data.cases[1].text, /30 enfants/);
  assert.match(data.cases[2].text, /violence/);
  assert.doesNotMatch(data.cases[2].text, /sous- développement/);
});

test('Reconstruction feedback distinguishes success, near miss and partial progress', async () => {
  const { feedbackName } = await import('../public/features/documents/development/engine.js');
  const example = data.cases[3];
  assert.equal(feedbackName(reconstruct(data, initial, example), example, 1), 'SGAGNE');
  assert.equal(feedbackName(initial, example, 1), null);
  assert.equal(feedbackName(initial, example, 3), 'SRECPAR1');
  assert.equal(feedbackName({ inputs: [0, ...example.inputs.slice(1)] }, example, 3), 'SRECPAR3');
  assert.equal(
    feedbackName({ inputs: [0, 0, 0, ...example.inputs.slice(3)] }, example, 3),
    'SRECPAR2',
  );
  assert.ok(assets.validation.SGAGNE.src);
  assert.ok(assets.validation.SGAGNE.audio);
});
