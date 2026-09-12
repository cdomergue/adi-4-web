import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { crateEntries } from '../public/features/room/activities.js';
const root = new URL('../public/game/room/activities/', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('catalog.json', root)));
const games = JSON.parse(
  await readFile(new URL('../public/game/games/catalog.json', import.meta.url)),
);

test('the crate keeps the three playable games and separates unfinished ports without duplicate thumbnails', () => {
  const available = crateEntries(catalog.games, games, 'available');
  assert.deepEqual(available.map((game) => game.id).sort(), ['mrmatt1', 'sokobfr', 'wgob3']);
  assert.deepEqual(available.map((game) => game.route).sort(), [
    '#game/mrmatt1',
    '#game/sokoban',
    '#game/wgob3',
  ]);
  const upcoming = crateEntries(catalog.games, games, 'upcoming');
  assert.ok(upcoming.length > 20);
  assert.ok(upcoming.every((game) => !game.route));
  const all = crateEntries(catalog.games, games);
  assert.equal(all.length, new Set(all.map((game) => game.id)).size);
  assert.equal(all.length, available.length + upcoming.length);
  assert.equal(all[0].title, 'BeeBop I');
});

test('radio menus preserve real NUL-terminated titles and include music, ambience and silence', () => {
  assert.equal(catalog.music.length, 17);
  assert.equal(catalog.ambience.length, 11);
  assert.equal(catalog.music.find((track) => track.id === 'naivjazy').title, 'Jazz');
  assert.equal(catalog.music.find((track) => track.id === 'regfunk').title, 'Funk');
  assert.equal(catalog.ambience.filter((track) => track.audio).length, 10);
  assert.equal(catalog.ambience.find((track) => !track.audio).title, 'Aucune ambiance');
  for (const track of [...catalog.music, ...catalog.ambience].filter((track) => track.audio)) {
    assert.ok(track.duration > 20 && track.duration < 65);
    assert.equal(track.sample_rate, 22050);
    assert.match(track.audio, /^\/game\/room\/activities\/[a-z0-9]+\.flac$/);
  }
});

test('a clone includes every extracted panel, thumbnail, font and lossless audio file intact', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root)));
  const files = new Set(manifest.map((item) => item.file));
  for (const entry of manifest) {
    const data = await readFile(new URL(entry.file, root));
    assert.equal(createHash('sha256').update(data).digest('hex'), entry.sha256, entry.file);
    if (entry.file.endsWith('.flac')) assert.equal(data.subarray(0, 4).toString(), 'fLaC');
  }
  for (const item of [...catalog.music, ...catalog.ambience, ...catalog.games]) {
    for (const field of ['audio', 'image'])
      if (item[field]) assert.ok(files.has(item[field].split('/').pop()), item[field]);
  }
  for (const required of [
    'menu.ttf',
    'crate-panel.webp',
    'radio-panel.webp',
    'crate-opening.webp',
    'radio-opening.webp',
  ])
    assert.ok(files.has(required));
  for (const kind of ['crate', 'radio']) {
    const actor = catalog.artwork[kind + 'Actor'];
    assert.equal(actor.idle.length, kind === 'crate' ? 9 : 5);
    for (const sequence of actor.idle) {
      assert.ok(files.has(sequence.file));
      assert.ok(sequence.duration > 500 && sequence.duration < 8000);
      const data = await readFile(new URL(sequence.file, root));
      assert.notEqual(data.indexOf('ANIM'), -1, 'must contain animation frames');
    }
    // A posture must enter and leave: looping a transition alone causes a visible jump.
    assert.ok(
      actor.idle.some(
        (sequence) =>
          sequence.clips.join(',') ===
          (kind === 'crate' ? 'ADIPZD24,ADIPZD25,ADIPZD26' : 'ADIPZD56,ADIPZD57,ADIPZD58'),
      ),
    );
  }
});
