import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../public/', import.meta.url);
test('a clone includes every Mr. Matt asset with its original export hash', async () => {
  const manifest = JSON.parse(await readFile(new URL('game/mrmatt1/manifest.json', root)));
  assert.ok(manifest.files.some((f) => f.name === 'levels.json'));
  assert.ok(manifest.files.some((f) => f.name === 'tiles.webp'));
  assert.equal(manifest.files.filter((f) => f.name.endsWith('.wav')).length, 12);
  for (const file of manifest.files) {
    const bytes = await readFile(new URL(`game/mrmatt1/${file.name}`, root));
    assert.equal(bytes.length, file.size, file.name);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, file.name);
  }
  const catalog = JSON.parse(await readFile(new URL('game/games/catalog.json', root)));
  assert.equal(catalog.find((g) => g.id === 'mrmatt1').route, '#game/mrmatt1');
});
