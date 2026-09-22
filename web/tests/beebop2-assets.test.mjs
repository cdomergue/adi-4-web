import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createGame } from '../public/features/games/beebop2/engine.js';
import { drawGame, drawMenu } from '../public/features/games/beebop2/renderer.js';

const root = new URL('../public/game/beebop2/', import.meta.url);
const campaign = JSON.parse(readFileSync(new URL('campaign.json', root)));
const manifest = JSON.parse(readFileSync(new URL('artwork.json', root)));

test('BeeBop II bundles both original paths, 305 images and 24 PCM sounds', () => {
  assert.equal(campaign.episode, 2);
  assert.equal(campaign.sourceSha256, manifest.executableSha256);
  assert.deepEqual(campaign.paths.map(p => p.length), [20, 20]);
  assert.equal(new Set(campaign.paths.flat()).size, 40);
  assert.equal(campaign.levels.length, 40);
  assert.equal(Object.keys(manifest.bitmaps).length, 189);
  assert.equal(Object.keys(manifest.icons).length, 116);
  assert.equal(Object.keys(manifest.sounds).length, 24);
  for (const group of ['bitmaps', 'icons']) for (const item of Object.values(manifest[group])) {
    assert.ok(existsSync(new URL(item.path, root)));
    assert.ok(item.width > 0 && item.height > 0);
  }
  for (const [name, path] of Object.entries(manifest.sounds)) {
    const wav = readFileSync(new URL(path, root));
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    assert.ok(manifest.soundDurations[name] > 0);
  }
});

test('BeeBop II renders both complete campaigns without missing images or simulation writes', () => {
  const art = { ...manifest, balls: Object.fromEntries([1,2,3,4,5,6].map(i => [i, {}])) };
  const ctx = { canvas: {}, save() {}, restore() {}, createPattern(image) { assert.ok(image); return {}; },
    fillRect() {}, drawImage(image, ...args) { assert.ok(image); assert.ok(args.every(Number.isFinite)); } };
  for (const path of [0, 1]) for (let i = 0; i < 20; i++) {
    const state = createGame(campaign, i, { path });
    for (const weapon of [0, 1, 2]) {
      state.weapon = weapon;
      state.phase = 'playing';
      const before = structuredClone(state);
      drawGame(ctx, state, art, campaign);
      drawGame(ctx, state, art, campaign, { type: 'won' });
      drawGame(ctx, state, art, campaign, { type: 'finale' });
      assert.deepEqual(state, before);
    }
  }
  drawMenu(ctx, art, { x: 100, y: 180 }, 36);
});
