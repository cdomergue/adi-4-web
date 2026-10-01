import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createSimulationState } from '../public/features/science/simulation-state.js';
import { cinemaClip } from '../public/features/science/cinema-player.js';
import { displaySequence } from '../public/features/science/sequence-player.js';
import { scenes } from '../public/features/science/scenes.js';
import { narration } from '../public/features/science/narration.js';
import { simulationAmbience, welcomeClips } from '../public/features/science/simulation-audio.js';
import dinosaurs from '../public/features/science/simulations/dinosaurs.js';
import eclipse from '../public/features/science/simulations/eclipse.js';
const read = (name) => JSON.parse(readFileSync(new URL(`../public/game/${name}`, import.meta.url)));
const catalog = read('science-media/catalog.json');

test('all 27 dinosaur experiments produce the native movie, then unlock GO for replay', () => {
  const data = read('station/sim-11.json'), found = new Set();
  for (let place = 1; place <= 3; place++) for (let time = 1; time <= 3; time++) for (let bait = 1; bait <= 3; bait++) {
    const session = createSimulationState(data, data.cases.find((c) => c.id === '0'));
    for (const [id, value] of [['1', place], ['2', time], ['3', bait]]) {
      assert.ok(session.change(id, value).accepted);
      session.finish();
    }
    for (let replay = 0; replay < 2; replay++) {
      const event = session.change('6', 2);
      assert.ok(event.accepted && event.action);
      assert.ok(displaySequence(session.data, event).includes('5'));
      const clip = cinemaClip(session.data, dinosaurs.cinema, catalog, '5', event.after['5']);
      assert.ok(clip && !clip.empty && !clip.missing);
      assert.deepEqual(clip.box.slice(0, 2), [142, 48]);
      assert.ok(clip.audio);
      found.add(clip.url);
      assert.equal(session.finish().states['6'], 1);
    }
  }
  assert.equal(found.size, 27);
});

test('both eclipse cameras have native framed cinema for every nonempty state', () => {
  const data = read('station/sim-13.json'), found = new Set();
  for (const id of eclipse.cinema.objects) for (const option of data.objects.find((o) => o.id === id).options) {
    const clip = cinemaClip(data, eclipse.cinema, catalog, id, option.id);
    assert.ok(!clip.missing);
    if (clip.empty) continue;
    assert.deepEqual(clip.box.slice(0, 2), [171, 114]);
    found.add(clip.url);
  }
  assert.equal(found.size, 7);
  assert.ok(catalog[eclipse.cinema.frame].url);
});

test('the nine laboratory films have clickable scenery, course references and real movies', () => {
  const docs = read('science-media/documents.json');
  assert.equal(Object.keys(docs).length, 9);
  for (const doc of Object.values(docs)) {
    const spot = scenes[doc.sector].spots.find((s) => s.to === `science-document/${doc.id}`);
    assert.ok(spot, doc.title);
    const movie = catalog.movies[doc.movie];
    assert.ok(movie.audio && movie.frames > 0);
    assert.ok(existsSync(new URL(`../public${movie.url}`, import.meta.url)));
  }
  // NIV6.INI: the heart opens ACIRCUL, health evaluation is the left monitor.
  assert.deepEqual(scenes.health.spots.find((s) => s.to === 'simulation/9').box, [0, 0, 262, 182]);
  assert.deepEqual(scenes.farm.spots.find((s) => s.to === 'simulation/7').box, [484, 196, 120, 75]);
});

test('every selected Adi intervention and every simulation welcome resolves to bundled audio', () => {
  const clips = read('science-media/actors.json').clips;
  for (const scene of Object.keys(scenes)) for (const level of ['6', '5', '4', '3']) for (let count = 1; count <= 5; count++) {
    for (const random of [0, .21, .41, .61, .99]) {
      for (const name of narration(scene, level, count, () => random)) assert.ok(clips[name]?.sound, `${scene}/${level}/${name}`);
    }
  }
  for (const id of [1,2,3,4,5,6,7,8,9,11,12,13,14,15]) {
    for (const level of ['6', '5', '4', '3']) assert.ok(welcomeClips(catalog, id, level).length, `${id}/${level}`);
  }
  for (let state = 1; state <= 4; state++) assert.ok(catalog.audio[simulationAmbience('7', { 1: state })]);
  for (let state = 1; state <= 3; state++) assert.ok(catalog.audio[simulationAmbience('6', { 6: state })]);
});

test('navigation cancels voices and timers; stale play rejection cannot stop a replacement voice', async () => {
  const { createMediaScope } = await import('../public/features/science/media.js');
  class Audio extends EventTarget {
    constructor() { super(); this.paused = true; this.pending = []; }
    play() { this.paused = false; return new Promise((resolve, reject) => this.pending.push({ resolve, reject })); }
    pause() { this.paused = true; }
    removeAttribute(name) { delete this[name]; }
    load() {}
    remove() { this.removed = true; }
  }
  const root = { ownerDocument: { createElement: () => new Audio() }, append() {} };
  const scope = createMediaScope(root, () => true);
  const voice = scope.channel();
  const first = new AbortController();
  const interrupted = scope.play(voice, 'first.flac', first.signal);
  first.abort();
  assert.equal(await interrupted, false);
  const replacement = scope.play(voice, 'second.flac');
  voice.pending[0].reject(new DOMException('Interrupted', 'AbortError'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(voice.paused, false);
  const waiting = scope.delay(60000);
  scope.dispose();
  assert.equal(await replacement, false);
  await waiting;
  assert.equal(voice.src, undefined);
  assert.equal(voice.removed, true);
});

test('native partial-success feedback follows ordered ant progress and closest ordinary solution', () => {
  const ant = read('station/sim-7.json');
  const session = createSimulationState(ant, ant.cases.find((c) => c.id === '1'));
  session.change('2', 7); session.finish();
  assert.equal(session.challenge().progress, 1);
  session.change('2', 5); session.finish();
  assert.equal(session.challenge().progress, 2);
  const dino = read('station/sim-11.json');
  const original = dino.cases.find((c) => c.id === '1');
  const candidate = { ...original, initial: { ...original.initial, 1: 1, 2: 1, 3: 1 },
    solutions: [{ 1: 2, 2: 2, 3: 2 }, { 1: 1, 2: 1, 3: 2 }] };
  const ordinary = createSimulationState(dino, candidate);
  assert.equal(ordinary.challenge().success, false);
  assert.equal(ordinary.challenge().help, 3);
  ordinary.change('3', 2); ordinary.finish();
  assert.equal(ordinary.challenge().success, true);
});
