import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import {
  createInitial,
  reconstruct,
  changeInput,
  availableOptions,
  populationRoot,
  transitionSteps,
  hitTest,
  scenePoint,
  matchesCase,
} from '../public/features/documents/ecosystem/engine.js';
import { spriteFrame } from '../public/features/documents/environment-animation.js';

const base = new URL('../public/game/documents/ecosystem/', import.meta.url);
const data = JSON.parse(await readFile(new URL('rules.json', base)));
const assets = JSON.parse(await readFile(new URL('assets.json', base)));

test('Ecosystem initial populations and original reconstruction cases', () => {
  const initial = createInitial(data);
  assert.deepEqual(initial.states, [0, 0, 0, 0, 4, 4, 4, 4, 2, 3]);
  const expected = [
    [0, 0, 2, 0, 4, 4, 0, 2, 2, 1],
    [0, 1, 0, 0, 4, 3, 3, 3, 1, 3],
    [3, 3, 2, 2, 1, 0, 0, 0, 0, 0],
  ];
  data.cases.forEach((example, index) => {
    const next = reconstruct(data, initial, example);
    assert.deepEqual(next.states, expected[index]);
    assert.ok(matchesCase(next, example));
    assert.equal(matchesCase(initial, example), false);
  });
  assert.throws(() => reconstruct(data, initial, { inputs: [-1, 0, 0, 0] }), RangeError);
});

test('Population changes use the previous fox population once per action', () => {
  const australia = reconstruct(data, createInitial(data), data.cases[0]);
  assert.equal(australia.values[6], 0);
  const hunting = changeInput(data, australia, 1, 1);
  assert.equal(hunting.values[5], 4);
  const protection = changeInput(data, hunting, 2, 0);
  assert.deepEqual(protection.states.slice(5, 7), [4, 4]);
  // Choosing the same setting again is still an action in MOTEUR:6aa8.
  const repeated = changeInput(data, protection, 2, 0);
  assert.deepEqual(repeated.states.slice(5, 7), [3, 3]);
  assert.deepEqual(protection.states.slice(5, 7), [4, 4], 'previous state is immutable');
  assert.equal(populationRoot(24), 4);
  assert.equal(populationRoot(32), 5);
  assert.equal(populationRoot(0), 0);
});

test('Protection restricts the hunting menu without inventing a correction to stored choices', () => {
  const initial = createInitial(data);
  assert.equal(availableOptions(data, initial, 1)[3].enabled, false);
  assert.equal(changeInput(data, initial, 1, 3), initial);
  assert.equal(changeInput(data, initial, 7, 0), initial);
  const unprotected = changeInput(data, initial, 2, 2);
  const wild = changeInput(data, unprotected, 1, 3);
  assert.equal(wild.states[1], 3);
  const protectedAgain = changeInput(data, wild, 2, 0);
  assert.equal(protectedAgain.states[1], 3);
  assert.equal(availableOptions(data, protectedAgain, 1)[3].enabled, false);
});

test('All 180 input combinations and their allowed actions resolve to bundled animations', () => {
  const initial = createInitial(data);
  for (let p = 0; p < 5; p++)
    for (let h = 0; h < 4; h++)
      for (let v = 0; v < 3; v++)
        for (let a = 0; a < 3; a++) {
          const state = reconstruct(data, initial, { inputs: [p, h, v, a] });
          state.states.forEach((n, i) => assert.ok(assets.objects[i][n], `${i}:${n}`));
          for (let element = 0; element < 4; element++)
            for (const option of availableOptions(data, state, element).filter((o) => o.enabled)) {
              const next = changeInput(data, state, element, option.index);
              next.states.forEach((n, i) => assert.ok(assets.objects[i][n], `${i}:${n}`));
              for (const step of transitionSteps(data, state, next, element))
                assert.ok(
                  (step.reverse ? assets.reverseObjects : assets.objects)[step.element][step.clip],
                );
            }
        }
});

test('Pollution propagates through grass, rabbits, foxes, crops and vegetation in native order', () => {
  const initial = createInitial(data),
    next = changeInput(data, initial, 0, 4);
  assert.deepEqual(next.states.slice(4), [0, 0, 0, 0, 0, 0]);
  const steps = transitionSteps(data, initial, next, 0);
  assert.deepEqual([...new Set(steps.map((s) => s.element))], [0, 4, 5, 6, 8, 7, 9]);
  assert.deepEqual(steps[0], { element: 0, state: 1, clip: 1, reverse: false });
  assert.deepEqual(steps[4], { element: 4, state: 3, clip: 4, reverse: true });
});

test('Scene clicks and keyboard markers keep original coordinates when resized', () => {
  const rect = { left: 20, top: 90, width: 320, height: 240 };
  for (const [element, point] of [
    [0, [45, 100]],
    [1, [310, 230]],
    [2, [370, 170]],
    [3, [90, 200]],
  ]) {
    const position = scenePoint(rect, rect.left + point[0] / 2, rect.top + point[1] / 2);
    assert.equal(hitTest(data, position.x, position.y), element);
  }
  data.markers.forEach(([x, y, w, h], i) => assert.equal(hitTest(data, x + w / 2, y + h / 2), i));
  assert.equal(hitTest(data, 640, 80), null);
  assert.equal(hitTest(data, -1, 50), null);
});

test('Long animations cross WebP sheet boundaries without disappearing', () => {
  const clip = assets.idleObjects.S07_9S03;
  assert.ok(Array.isArray(clip.src));
  assert.deepEqual(spriteFrame(clip, clip.framesPerSheet - 1), {
    src: clip.src[0],
    y: (clip.framesPerSheet - 1) * clip.height,
  });
  assert.deepEqual(spriteFrame(clip, clip.framesPerSheet), { src: clip.src[1], y: 0 });
  assert.equal(spriteFrame(clip, clip.frames + 100).src, clip.src.at(-1));
});

test('Ecosystem media, diagram sequences and sounds are local client resources', async () => {
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
  assert.ok(assets.voice.S07_VO.audio);
  assert.ok(assets.ambience.A_MUS07.audio);
  for (const name of data.effectNames.flat().filter((n) => n !== 'SILENCE'))
    assert.ok(assets.audioEffects[name]?.audio, name);
  for (const clip of Object.values(assets.explanations)) assert.equal(clip.transparentIndex, 0);
});
