import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createEnvironmentAtmosphere } from '../public/features/documents/environment-atmosphere.js';
import { feedbackName } from '../public/features/documents/environment-feedback.js';

const folders = ['air', 'ecosystem', 'company', 'water', 'desert', 'development'];
const docs = await Promise.all(
  folders.map(async (folder) => {
    const base = new URL(`../public/game/documents/${folder}/`, import.meta.url);
    return {
      folder,
      data: JSON.parse(await readFile(new URL('rules.json', base))),
      assets: JSON.parse(await readFile(new URL('assets.json', base))),
    };
  }),
);

test('Every selected idle and atmosphere has media and an explicit native layer', () => {
  for (const { folder, data, assets } of docs) {
    const prefix = Object.keys(assets.idleObjects)[0].slice(0, 3);
    assert.equal(data.priorities.objects.length, data.labels.length, folder);
    assert.equal(data.idleModes.length, data.labels.length, folder);
    assert.deepEqual(
      data.idleEnabled,
      data.idleModes.map((mode) => Number(mode === 1)),
    );
    for (let i = 0; i < data.labels.length; i++) {
      if (data.idleModes[i] !== 1 && data.idleModes[i] !== 4) continue;
      for (let state = 0; state < data.options[i].length; state++)
        assert.ok(
          assets.idleObjects[`${prefix}_${i}S${String(state).padStart(2, '0')}`]?.src,
          `${folder}:${i}:${state}`,
        );
    }
    for (let draw = 0; draw < 10; draw++) {
      const atmosphere = createEnvironmentAtmosphere(data, assets, prefix, () => draw / 10);
      const first = atmosphere.tick(data.labels.map(() => 0));
      if (first.ambient) assert.ok(Number.isFinite(first.ambient.priority));
      assert.equal(first.idleFrame, 0);
      atmosphere.tick(data.labels.map(() => 0));
      atmosphere.reset();
      assert.equal(atmosphere.tick(data.labels.map(() => 0)).idleFrame, 0);
    }
  }
});

test('Silent random slots do not manufacture animations and S07 hunter uses object priority', () => {
  const { data, assets } = docs.find((x) => x.folder === 'ecosystem');
  const scene = createEnvironmentAtmosphere(data, assets, 'S07', () => 1 / 6);
  const frame = scene.tick(Array(10).fill(0));
  assert.equal(frame.ambient.resource, assets.idleObjects.S07_1S00);
  assert.equal(frame.ambient.priority, data.priorities.idle[1]);
  const quiet = createEnvironmentAtmosphere(data, assets, 'S07', () => 0);
  assert.equal(quiet.tick(Array(10).fill(0)).ambient, null);
});

test('Spoken feedback follows success and the third validation thresholds', () => {
  const example = { inputs: [1, 1, 1, 1, 1] };
  assert.equal(feedbackName({ inputs: [1, 1, 1, 1, 1] }, example, 1), 'SGAGNE');
  assert.equal(feedbackName({ inputs: [1, 0, 0, 0, 0] }, example, 2), null);
  assert.equal(feedbackName({ inputs: [1, 0, 0, 0, 0] }, example, 3), 'SRECPAR1');
  assert.equal(feedbackName({ inputs: [1, 1, 0, 0, 0] }, example, 3), 'SRECPAR2');
  assert.equal(feedbackName({ inputs: [1, 1, 1, 1, 0] }, example, 3), 'SRECPAR3');
});
