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
} from '../public/features/documents/desert/engine.js';
import { createEnvironmentAtmosphere } from '../public/features/documents/environment-atmosphere.js';
const base = new URL('../public/game/documents/desert/', import.meta.url);
const data = JSON.parse(await readFile(new URL('rules.json', base)));
const assets = JSON.parse(await readFile(new URL('assets.json', base)));

test('Desertification initial state and the three original case solutions', () => {
  const initial = createInitial(data);
  assert.deepEqual(initial.values, [4, 0, 0, 4, 4, 4, 4, 4, 4]);
  const expected = [
    [3, 1, 1, 1, 1, 3, 3, 1, 1],
    [1, 0, 0, 1, 1, 1, 1, 1, 1],
    [4, 2, 2, 1, 1, 4, 4, 1, 1],
  ];
  data.cases.forEach((example, i) => {
    const result = reconstruct(data, initial, example);
    assert.deepEqual(result.values, expected[i]);
    assert.ok(matchesCase(result, example));
  });
  assert.throws(() => evaluate(data, [5, 0, 0]), RangeError);
  assert.throws(() => evaluate(data, [0, -1, 0]), RangeError);
  assert.throws(() => evaluate(data, null), RangeError);
  assert.equal(changeInput(data, initial, 3, 0), initial);
});

test('Electricity and irrigation affect distinct resources without changing agricultural demand', () => {
  const initial = createInitial(data);
  const electricity = changeInput(data, initial, 1, 2);
  assert.deepEqual(electricity.values, [4, 2, 0, 1, 1, 4, 4, 4, 4]);
  assert.deepEqual(
    [...new Set(transitionSteps(data, initial, electricity, 1).map((s) => s.element))],
    [1, 3, 4],
  );
  const water = changeInput(data, initial, 2, 2);
  assert.deepEqual(water.values, [4, 0, 2, 4, 4, 4, 4, 1, 1]);
  assert.deepEqual(
    [...new Set(transitionSteps(data, initial, water, 2).map((s) => s.element))],
    [2, 7, 8],
  );
  assert.deepEqual(initial.inputs, [4, 0, 0]);
  assert.deepEqual(evaluate(data, [0, 2, 2]).values, [0, 2, 2, 0, 0, 0, 0, 0, 0]);
});

test('All 45 input combinations and their transitions have original media', () => {
  let count = 0;
  for (let population = 0; population < 5; population++)
    for (let electricity = 0; electricity < 3; electricity++)
      for (let water = 0; water < 3; water++) {
        count++;
        const state = evaluate(data, [population, electricity, water]);
        state.states.forEach((value, i) => assert.ok(assets.objects[i][value], `${i}:${value}`));
        for (let i = 0; i < 3; i++)
          for (const option of availableOptions(data, state, i)) {
            assert.equal(option.enabled, true);
            const next = changeInput(data, state, i, option.index);
            for (const step of transitionSteps(data, state, next, i))
              assert.ok(
                (step.reverse ? assets.reverseObjects : assets.objects)[step.element][step.clip],
              );
          }
      }
  assert.equal(count, 45);
});

test('Original landscape controls and all nine help markers remain reachable when scaled', () => {
  const rect = { left: 12, top: 30, width: 960, height: 720 };
  for (const [i, [x, y]] of [
    [0, [400, 400]],
    [1, [30, 110]],
    [2, [490, 120]],
  ]) {
    const point = scenePoint(rect, rect.left + x * 1.5, rect.top + y * 1.5);
    assert.equal(hitTest(data, point.x, point.y), i);
  }
  data.markers.forEach(([x, y, w, h], i) => assert.equal(hitTest(data, x + w / 2, y + h / 2), i));
  assert.equal(hitTest(data, 640, 480), null);
});

test('Original ambient timing excludes immediate repeats and respects the exclusive random bound', () => {
  const sequence = [0.4, 0.4, 0, 0.99, 0];
  const atmosphere = createEnvironmentAtmosphere(data, assets, 'S14', () => sequence.shift() ?? 0);
  assert.equal(
    atmosphere.tick(data.initialStates).ambient.resource,
    assets.ambientReactions.S14_0H,
  );
  let next;
  for (let i = 1; i <= 251; i++) next = atmosphere.tick(data.initialStates);
  assert.equal(next.ambient, null, 'same animation is not repeated at the first 20-second check');
  for (let i = 252; i <= 502; i++) next = atmosphere.tick(data.initialStates);
  assert.equal(next.ambient.resource, assets.ambientReactions.S14_1H);
  assert.equal(next.ambient.frame, 0);
  assert.equal(next.idleFrame, 502);
  atmosphere.reset();
  assert.equal(atmosphere.tick(data.initialStates).idleFrame, 0);
  const maximum = createEnvironmentAtmosphere(data, assets, 'S14', () => 0.99999);
  assert.equal(
    maximum.tick(data.initialStates).ambient.resource,
    assets.ambientReactions.S14_1H,
    'RAND(3) returns at most 2; S14_2H is not selected by the original script',
  );
});

test('Scene priorities keep the foreground tree over atmosphere and the wood animation over the market', () => {
  assert.ok(data.priorities.foreground > Math.max(...data.priorities.ambient));
  assert.ok(data.priorities.idle[3] > data.priorities.objects[5]);
  assert.deepEqual(data.idleEnabled, [0, 0, 0, 1, 0, 0, 0, 0, 0]);
  assert.equal(data.explanationZones.length, 4);
});

test('All original voices, choice effects, four explanations and the foreground are bundled', async () => {
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
  assert.ok(assets.foregroundObjects.S14_0OP.src);
  assert.equal(Object.keys(assets.explanations).length, 4);
  assert.equal(Object.keys(assets.caseAudio).length, 3);
  assert.ok(assets.voice.S14_VO.audio);
  assert.ok(assets.ambience.A_MUS14.audio);
  for (const name of data.effectNames.flat().filter((n) => n !== 'SILENCE'))
    assert.ok(assets.audioEffects[name]?.audio, name);
});

test('Explanation sequencing includes the voice tail after the final video frame', async () => {
  const { clipDuration, spriteFrame } = await import(
    '../public/features/documents/environment-animation.js'
  );
  const clip = assets.explanations.S14_RE00;
  assert.ok(clip.duration > clip.frames / clip.fps);
  assert.equal(clipDuration(clip), clip.duration * 1000);
  assert.deepEqual(spriteFrame(clip, clip.frames + 20), spriteFrame(clip, clip.frames - 1));
});
