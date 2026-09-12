import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const publicRoot = new URL('../public/', import.meta.url);
const read = (path) => readFile(new URL(path, publicRoot));
const json = async (path) => JSON.parse(await read(path));

test('a clone contains the complete WGOB3 game and compiled runtime', async () => {
  const data = await json('game/wgob3/manifest.json');
  assert.equal(data.files.length, 9);
  const runtime = await json('vendor/wgob3/build.json');
  for (const name of ['scummvm.js', 'scummvm.wasm', 'translations.dat', 'COPYING', 'COPYRIGHT']) {
    assert.ok(
      runtime.files.some((file) => file.name === name),
      `Missing runtime member: ${name}`,
    );
  }
  for (const [directory, files] of [
    ['game/wgob3/', data.files],
    ['vendor/wgob3/', runtime.files],
  ]) {
    for (const file of files) {
      const bytes = await read(directory + file.name);
      assert.equal(bytes.length, file.size, directory + file.name);
      assert.equal(
        createHash('sha256').update(bytes).digest('hex'),
        file.sha256,
        directory + file.name,
      );
    }
  }
  assert.deepEqual(
    [...(await read('vendor/wgob3/scummvm.wasm')).subarray(0, 8)],
    [0, 97, 115, 109, 1, 0, 0, 0],
  );
});

test('application startup and game-library dependencies are bundled', async () => {
  // app.js waits for this catalogue even when opening the WGOB3 route directly.
  const catalogue = await json('game/catalog.json');
  assert.ok(catalogue.courses.length > 0);
  for (const course of catalogue.courses) assert.ok(catalogue.pages[course.page]);
  const games = await json('game/games/catalog.json');
  assert.equal(games.find((game) => game.id === 'wgob3').route, '#game/wgob3');
  for (const game of games) {
    if (game.image) assert.ok((await stat(new URL('.' + game.image, publicRoot))).isFile());
  }
  for (const path of [
    'game/room/bedroom.webp',
    'game/room/clips.json',
    'wgob3/player.html',
    'wgob3/player.js',
    'wgob3/player.css',
    'wgob3/saves.js',
  ]) {
    assert.ok((await stat(new URL(path, publicRoot))).size > 0, path);
  }
});
