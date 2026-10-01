import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { roomObjectAt, roomCloseups, chooseRoomVoice } from '../public/features/room/interactions.js';
import { createCloseupPlayer } from '../public/features/room/closeup-player.js';

const base = new URL('../public/game/room/closeups/', import.meta.url);
const catalog = JSON.parse(readFileSync(new URL('catalog.json', base)));

test('native bedroom targets open their documents and the chest opens the environmental experiments', () => {
  // EDIINTRO:51f2 + DOC:01e5 + MENUEVCO.PFR. Atlas overlaps the mobile.
  for (const [x, y, route] of [
    [130, 330, 'animal'], [230, 140, 'atlas'], [170, 110, 'planete'],
    [550, 220, 'astro'], [200, 60, 'espace'], [530, 50, 'cycle'],
    [40, 390, 'experiments'], [410, 160, 'results'], [590, 350, 'rewards'],
  ]) assert.equal(roomObjectAt(x, y)?.route, `room/${route}`);
  assert.equal(roomObjectAt(40, 320), undefined);
  assert.deepEqual(catalog.experiments.map(item => item.id), ['s16', 's17', 's12', 's14', 's07', 's08']);
  const documents = JSON.parse(readFileSync(new URL('../public/game/documents/catalog.json', import.meta.url)));
  for (const item of catalog.experiments) {
    assert.ok(documents.some(doc => doc.route === `document/${item.id}`));
    assert.ok(existsSync(new URL(item.image, base)));
  }
});

test('every close-up has original narration and its native actor placement or voice-over', () => {
  assert.deepEqual(roomCloseups.animal.offset, [255, -12]);
  assert.deepEqual(roomCloseups.astro.offset, [285, 33]);
  assert.deepEqual(roomCloseups.cycle.offset, [-180, 0]);
  for (const [id, config] of Object.entries(roomCloseups)) {
    for (const name of config.voices) {
      const clip = catalog.clips[name];
      assert.ok(clip?.audio, `${id}: ${name}`);
      assert.ok(clip.duration > 0);
      assert.equal(Boolean(clip.file), Boolean(config.pose));
    }
    if (config.transition) assert.ok(catalog.clips[config.transition]?.file);
  }
  for (const clip of Object.values(catalog.clips)) {
    for (const file of [clip.file, clip.audio].filter(Boolean)) assert.ok(existsSync(new URL(file, base)), file);
  }
  assert.equal(catalog.clips.CMENUMAL.sourceFrames, 41);
  assert.equal(catalog.clips.CMENUMAL.frames, 39); // omit the unused scrollbar frames
  assert.equal(chooseRoomVoice(['a', 'b'], 'a', () => 0), 'b');
});

test('leaving during an audio load settles playback and cannot resume a stale close-up', async t => {
  const previousDocument = globalThis.document;
  const elements = [];
  let releaseAudio;
  globalThis.document = { createElement(tag) {
    const element = { tag, style: {}, dataset: {}, hidden: false,
      pause() {}, removeAttribute(name) { delete this[name]; }, remove() { this.removed = true; },
      play() { return new Promise(resolve => { releaseAudio = resolve; }); },
    };
    elements.push(element);
    return element;
  } };
  t.after(() => { if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument; });
  const frame = { append() {} };
  const player = createCloseupPlayer(frame, { clips: { voice: {
    file: 'talk.webp', audio: 'talk.flac', duration: 5000, x: 0, y: 0, width: 50, height: 50,
  } } });
  const playing = player.play('voice');
  const image = elements.find(element => element.tag === 'img');
  const loaded = image.onload();
  player.dispose();
  assert.equal(await playing, false);
  releaseAudio();
  await loaded;
  assert.equal(image.hidden, true);
  assert.ok(elements.every(element => element.removed));
  assert.equal(await player.play('voice'), false);
});
