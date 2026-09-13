import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createSimulationState } from '../public/features/science/simulation-state.js';
import { caseData } from '../public/features/science/interaction-model.js';
import {
  createSequencePlayer, displaySequence, stateMedia, transitionSteps, webpDuration,
} from '../public/features/science/sequence-player.js';

const read = (path) => JSON.parse(readFileSync(new URL(`../public/game/station/${path}`, import.meta.url)));
const assets = { ...read('assets.json'), ...read('sequences/assets.json') };

test('sequential transitions use the increasing destination and decreasing old-state clips', () => {
  const source = read('sim-2.json'), data = caseData(source, source.cases[0]);
  const increasing = transitionSteps(data, { before: {2: 1}, after: {2: 4} }, '2', assets);
  assert.deepEqual(increasing.map((s) => s.state), [2, 3, 4]);
  assert.ok(increasing.every((s) => s.asset.source.endsWith('.VMD')));
  assert.ok(increasing[0].asset.source.endsWith('02S20002.VMD'));
  const decreasing = transitionSteps(data, { before: {2: 4}, after: {2: 1} }, '2', assets);
  assert.deepEqual(decreasing.map((s) => s.state), [3, 2, 1]);
  assert.ok(decreasing.every((s) => s.asset.source.endsWith('.RMD')));
  assert.ok(decreasing[0].asset.source.endsWith('02S20004.RMD'));
  assert.ok(stateMedia(data, '2', 2, assets).source.endsWith('.VMD'));
});

test('the terrestrial gauge uses its own case-specific image, including at initialization', () => {
  const source = read('sim-12.json');
  const earth = caseData(source, source.cases[3]), venus = caseData(source, source.cases[1]);
  for (const state of [2, 6]) {
    const asset = stateMedia(earth, '12', state, assets);
    assert.ok(asset.source.endsWith('12DC0006.VMD'));
    assert.deepEqual([asset.x, asset.y, asset.width, asset.height], [308, 235, 103, 38]);
  }
  assert.ok(stateMedia(venus, '12', 2, assets).source.endsWith('12DC0002.VMD'));
});

test('GO camera presentation never replays unrelated scene layers', () => {
  const source = read('sim-13.json'), s = createSimulationState(source, source.cases[0]);
  assert.deepEqual(displaySequence(s.data, s.change('8', 2)), ['8', '11']);
  s.finish();
  assert.deepEqual(displaySequence(s.data, s.change('9', 2)), ['9', '12']);
});

test('all supplementary media are referenced, decodable WebPs with bounded dimensions', () => {
  const manifest = read('sequences/assets.json');
  const references = new Set();
  for (const asset of Object.values(manifest)) {
    assert.ok(asset.width > 0 && asset.width <= 641); // Some native backgrounds include one padding column.
    assert.ok(asset.height > 0 && asset.height <= 480);
    for (const url of [asset.url, asset.motion].filter(Boolean)) {
      references.add(url.split('/').at(-1));
      const path = new URL(`../public${url}`, import.meta.url);
      assert.ok(existsSync(path), url);
      const buffer = readFileSync(path);
      const duration = webpDuration(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
      assert.ok(duration >= 0 && duration < 600000, url);
    }
  }
  for (const file of readdirSync(new URL('../public/game/station/sequences/', import.meta.url))) {
    assert.ok(file === 'assets.json' || references.has(file), `orphan export ${file}`);
  }
  assert.throws(() => webpDuration(new ArrayBuffer(2)), /Invalid/);
});

test('reset cancels a sequence waiting on voice without painting stale results', async () => {
  const source = read('sim-13.json'), s = createSimulationState(source, source.cases[0]);
  const painted = [];
  const player = createSequencePlayer({
    draw: (...args) => painted.push(args),
    voice: (_, signal) => new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true })),
    unavailable: () => assert.fail('unexpected media access'),
  });
  const running = player.play(s.data, s.change('8', 2), {});
  assert.equal(painted.length, 1);
  player.reset();
  assert.equal(await running, false);
  assert.equal(painted.length, 1);
});
