import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../public/', import.meta.url);
for (const episode of [1, 2]) test(`a clone includes every Mr. Matt ${episode} asset with its original export hash`, async () => {
  const manifest = JSON.parse(await readFile(new URL(`game/mrmatt${episode}/manifest.json`, root)));
  assert.ok(manifest.files.some((f) => f.name === 'levels.json'));
  const levels = JSON.parse(await readFile(new URL(`game/mrmatt${episode}/levels.json`, root)));
  assert.equal(levels.credits.copyright, '© 1995-97 by J.A.Wrotniak');
  assert.equal(levels.credits.source, `MRMATT${episode}.EXE`);
  const assets = [...manifest.files, ...(manifest.sharedAssets || [])];
  assert.ok(assets.some((f) => f.name.endsWith('tiles.webp')));
  assert.equal(assets.filter((f) => f.name.endsWith('.wav')).length, 12);
  for (const file of manifest.files) {
    const bytes = await readFile(new URL(`game/mrmatt${episode}/${file.name}`, root));
    assert.equal(bytes.length, file.size, file.name);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, file.name);
  }
  for (const file of manifest.sharedAssets || []) {
    const bytes = await readFile(new URL(`game/${file.name}`, root));
    assert.equal(bytes.length, file.size, file.name);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, file.name);
  }
  const catalog = JSON.parse(await readFile(new URL('game/games/catalog.json', root)));
  assert.equal(catalog.find((g) => g.id === `mrmatt${episode}`).route, `#game/mrmatt${episode}`);
});
