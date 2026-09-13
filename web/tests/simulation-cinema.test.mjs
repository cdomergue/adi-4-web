import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { cinemaClip, createCinemaPlayer, isCinemaObject } from '../public/features/science/cinema-player.js';
import { createSequencePlayer, displaySequence } from '../public/features/science/sequence-player.js';
import { createSimulationState } from '../public/features/science/simulation-state.js';
import { caseData } from '../public/features/science/interaction-model.js';
import anthill from '../public/features/science/simulations/anthill.js';

const read = (path) => JSON.parse(readFileSync(new URL(`../public/game/station/${path}`, import.meta.url)));
const source = read('sim-7.json');
const catalog = read('anthill/catalog.json');
const config = anthill.cinema;
const session = () => createSimulationState(source, source.cases[1]);

test('all anthill cinema states use opaque movies in the original zoom rectangle', () => {
  assert.equal(isCinemaObject(undefined, '5'), false);
  assert.equal(isCinemaObject(config, '4'), false);
  const urls = new Set();
  for (const situation of source.cases) {
    const data = caseData(source, situation);
    assert.equal(cinemaClip(data, config, catalog, '4', 1), null);
    for (const id of config.objects) {
      for (const option of data.objects.find((o) => o.id === id).options) {
        const clip = cinemaClip(data, config, catalog, id, option.id);
        assert.ok(!clip.missing, `${situation.id}/${id}/${option.id}`);
        if (clip.empty) continue;
        assert.deepEqual(clip.box, [121, 112, 400, 300]);
        assert.ok(clip.frames > 0 && clip.fps > 0);
        const bytes = readFileSync(new URL(`../public${clip.url}`, import.meta.url));
        assert.equal(bytes.toString('ascii', 4, 8), 'ftyp');
        urls.add(clip.url.split('/').at(-1));
      }
    }
  }
  assert.equal(urls.size, 41);
  const files = readdirSync(new URL('../public/game/station/anthill/', import.meta.url));
  assert.deepEqual(files.filter((s) => s.endsWith('.mp4')).sort(), [...urls].sort());
  assert.ok(catalog.frame.url.endsWith('/07ZOOM.webp'));
});

test('a repeated place replays its cinema without persisting any movie as a scene sprite', async () => {
  const s = session(), painted = [], played = [];
  const player = createSequencePlayer({
    draw: (id) => painted.push(id), voice: async () => {},
    unavailable: () => assert.fail('unexpected media access'),
    movie: async (data, id, state) => {
      const clip = cinemaClip(data, config, catalog, id, state);
      if (!clip) return false;
      if (!clip.empty) played.push(clip.url);
      return true;
    },
  });
  for (let repeat = 0; repeat < 2; repeat++) {
    const event = s.change('2', 7);
    assert.ok(displaySequence(s.data, event).includes('7'));
    assert.equal(await player.play(s.data, event, {}), true);
    s.finish();
  }
  assert.equal(played.length, 2);
  assert.equal(played[0], played[1]);
  assert.ok(painted.every((id) => !isCinemaObject(config, id)));
  assert.equal(s.challenge().success, false);
});

// Minimal media DOM: lifecycle tests run without codecs, timers or a browser.
function fixture() {
  let rejectPlay, sound = true, failures = 0;
  class Element extends EventTarget {
    constructor(tag) { super(); this.tag = tag; this.children = []; this.style = {}; }
    setAttribute() {}
    append(...elements) {
      this.children.push(...elements);
      for (const element of elements) element.parent = this;
    }
    remove() { this.parent.children = this.parent.children.filter((e) => e !== this); }
    removeAttribute(name) { delete this[name]; }
    focus() {}
    pause() { this.paused = true; }
    load() {}
    play() { return new Promise((resolve, reject) => { rejectPlay = reject; }); }
  }
  const frame = new Element('frame');
  frame.ownerDocument = { createElement: (tag) => new Element(tag) };
  const player = createCinemaPlayer({
    frame, config, catalog, soundEnabled: () => sound, unavailable: () => failures++,
  });
  const s = session(), event = s.change('2', 7), controller = new AbortController();
  return {
    frame, player, controller,
    start: () => player.play(s.data, '7', event.after['7'], controller.signal),
    movie: () => frame.children[0].children.find((e) => e.tag === 'video'),
    button: () => frame.children[0].children.find((e) => e.tag === 'button'),
    reject: () => rejectPlay(new Error('Playback interrupted')),
    mute: () => { sound = false; player.updateSound(); },
    failures: () => failures,
  };
}

test('ended, close, reset and abort all restore the scene and release the video', async () => {
  for (const exit of ['ended', 'close', 'reset', 'abort']) {
    const f = fixture(), running = f.start(), video = f.movie();
    assert.equal(video.muted, false);
    f.mute();
    assert.equal(video.muted, true);
    if (exit === 'ended') video.dispatchEvent(new Event('ended'));
    if (exit === 'close') f.button().dispatchEvent(new Event('click'));
    if (exit === 'reset') f.player.reset();
    if (exit === 'abort') f.controller.abort();
    assert.equal(await running, true);
    f.reject();
    await Promise.resolve();
    assert.equal(f.failures(), 0, `stale play rejection after ${exit}`);
    assert.equal(video.paused, true);
    assert.equal(video.src, undefined);
    assert.deepEqual(f.frame.children, []);
  }
});

test('a media failure reports once and does not leave an unclosable overlay', async () => {
  const f = fixture(), running = f.start();
  f.movie().dispatchEvent(new Event('error'));
  assert.equal(await running, true);
  f.reject();
  await Promise.resolve();
  assert.equal(f.failures(), 1);
  assert.deepEqual(f.frame.children, []);
});

test('reset during cinema aborts the enclosing sequence before stale drawing', async () => {
  const s = session(), painted = [];
  let entered;
  const ready = new Promise((resolve) => { entered = resolve; });
  const player = createSequencePlayer({
    draw: (id) => painted.push(id), voice: async () => {},
    unavailable: () => assert.fail('unexpected media access'),
    movie: async (data, id, state, signal) => {
      if (!isCinemaObject(config, id)) return false;
      entered();
      await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
      return true;
    },
  });
  const running = player.play(s.data, s.change('2', 7), {});
  await ready;
  const previous = [...painted];
  player.reset();
  assert.equal(await running, false);
  assert.deepEqual(painted, previous);
  assert.ok(painted.every((id) => !isCinemaObject(config, id)));
});
