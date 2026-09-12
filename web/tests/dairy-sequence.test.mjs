import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { calculateSimulation } from '../public/features/science/simulation-engine.js';
import { productionSteps, frameAt, frameRect } from '../public/features/science/simulations/dairy-sequence.js';
import { createDairyPlayer } from '../public/features/science/simulations/dairy-player.js';

const root = new URL('../public/game/station/', import.meta.url);
const data = JSON.parse(readFileSync(new URL('sim-1.json', root)));
const catalog = JSON.parse(readFileSync(new URL('dairy/catalog.json', root)));
const recipe = (values) => calculateSimulation(data, { ...data.cases[0].initial, ...values }).states;

test('dairy follows native production order and skips absent operations for yoghurt', () => {
  const cheese = productionSteps(data, recipe({ 1: 2, 2: 2, 3: 2 }), catalog);
  assert.deepEqual(cheese.map((step) => step.object), ['9', '4', '5', '6', '7', '8']);
  assert.equal(cheese[1].clip.frameMap.length, 119);
  assert.equal(cheese[1].duration, 119 * 1000 / 12);
  assert.equal(cheese[1].clip.transparent, false);
  assert.equal(cheese[4].clip.transparent, false);
  assert.equal(cheese[5].clip.transparent, true);
  assert.deepEqual(productionSteps(data, recipe({ 1: 1, 2: 6, 3: 1 }), catalog)
    .map((step) => step.object), ['9', '4', '7', '8']);
});

test('every recipe has complete bundled production frames and exact export hashes', () => {
  for (let a = 1; a <= 2; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 5; c++) {
    const steps = productionSteps(data, recipe({ 1: a, 2: b, 3: c }), catalog);
    assert.ok(steps.some((step) => step.object === '7'));
    for (const { clip } of steps) {
      assert.equal(frameAt(clip, Infinity), clip.frameMap.length - 1);
      for (let index = 0; index < clip.frameMap.length; index++) {
        const rect = frameRect(clip, index);
        assert.ok(clip.pages[rect.page]);
        assert.ok(rect.x >= 0 && rect.y >= 0);
      }
    }
  }
  for (const clip of Object.values(catalog.clips)) for (const [file, hash] of Object.entries(clip.exports)) {
    assert.equal(createHash('sha256').update(readFileSync(new URL(`dairy/${file}`, root))).digest('hex'), hash);
  }
});

function harness(t) {
  let callback, time = 0;
  const draws = [], states = [];
  const canvas = { hidden: false, setAttribute() {}, getContext: () => ({
    clearRect() {}, getImageData: () => ({}), putImageData() {},
    drawImage(...args) { draws.push(args); },
  }) };
  const frame = { dataset: {}, append() {} };
  const audio = { pause() {}, play: async () => {} };
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => catalog }));
  const originals = {};
  for (const [name, value] of Object.entries({
    document: { hidden: false, createElement: () => canvas, addEventListener() {}, removeEventListener() {} },
    Image: class { set src(value) { this.url = value; queueMicrotask(() => this.onload()); } },
    requestAnimationFrame: (fn) => { callback = fn; return 1; },
    cancelAnimationFrame: () => { callback = null; },
  })) {
    originals[name] = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  t.after(() => {
    for (const [name, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  const player = createDairyPlayer({ frame, audio, soundEnabled: () => false,
    changed() {}, powerOff() { states.push('power-off'); },
    announce() { states.push(frame.dataset.sequenceStage); },
  });
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  return { player, frame, canvas, draws, states, flush,
    async tick() { const fn = callback; callback = null; time += 100; fn?.(time); await flush(); },
  };
}

test('nothing plays before Power, then stages finish one by one before the plate and result', async (t) => {
  const h = harness(t);
  h.player.reset();
  assert.equal(h.draws.length, 0);
  assert.equal(h.player.complete, false);
  const running = h.player.start(data, recipe({ 1: 2, 2: 2, 3: 2 }));
  await h.flush();
  assert.equal(h.frame.dataset.sequenceStage, '9');
  assert.equal(h.player.complete, false);
  for (let n = 0; n < 600 && h.player.busy; n++) await h.tick();
  await running;
  assert.deepEqual(h.states, ['loading', '9', '4', '5', '6', '7', '8', 'power-off', 'complete']);
  assert.equal(h.player.complete, true);
  assert.equal(h.canvas.hidden, false);
  h.player.dispose();
});

test('reset or leaving during fabrication cancels all later stages and late loading callbacks', async (t) => {
  const h = harness(t);
  const loading = h.player.start(data, recipe({ 1: 2, 2: 2, 3: 2 }));
  h.player.reset();
  await loading;
  assert.equal(h.draws.length, 0);
  assert.equal(h.canvas.hidden, true);
  const running = h.player.start(data, recipe({ 1: 2, 2: 2, 3: 2 }));
  await h.flush();
  for (let n = 0; n < 30; n++) await h.tick();
  assert.equal(h.frame.dataset.sequenceStage, '4');
  h.player.dispose();
  const before = h.draws.length;
  for (let n = 0; n < 30; n++) await h.tick();
  await running;
  assert.equal(h.draws.length, before);
  assert.equal(h.player.complete, false);
  assert.equal(h.frame.dataset.sequenceStage, 'idle');
});
