import { nativeDocuments } from '../public/features/documents/native-config.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  scenePoint,
  maskColor,
  menuOffset,
  spacePoint,
} from '../public/features/documents/engine.js';
const data = async (file) =>
  JSON.parse(
    await readFile(new URL(`../public/game/documents/${file}.json`, import.meta.url), 'utf8'),
  );

test('document clicks retain source pixels after responsive scaling', () => {
  const bounds = { left: 120, top: 80, width: 960, height: 720 };
  assert.deepEqual(scenePoint(120 + 329 * 1.5, 80 + 173 * 1.5, bounds), { x: 329, y: 173 });
  assert.deepEqual(scenePoint(1079.9, 799.9, bounds), { x: 639, y: 479 });
  assert.equal(scenePoint(1080, 400, bounds), null);
  assert.equal(scenePoint(120, 800, bounds), null);
  assert.equal(scenePoint(119, 80, bounds), null);
  assert.equal(scenePoint(0, 0, { left: 0, top: 0, width: 0, height: 0 }), null);
});

test('hit masks distinguish neighboring shapes instead of their enclosing boxes', () => {
  const pixels = new Uint8ClampedArray([
    100, 100, 100, 255, 0, 0, 0, 255, 101, 101, 101, 255, 100, 100, 100, 255,
  ]);
  assert.equal(maskColor(pixels, 2, 2, { x: 0, y: 0 }), 100);
  assert.equal(maskColor(pixels, 2, 2, { x: 1, y: 0 }), 0);
  assert.equal(maskColor(pixels, 2, 2, { x: 0, y: 1 }), 101);
  assert.equal(maskColor(pixels, 2, 2, { x: 2, y: 0 }), 0);
  assert.equal(maskColor(pixels, 2, 2, null), 0);
});

test('seven-row document menu scrolls one row and keeps the last entries reachable', () => {
  assert.equal(menuOffset(0, -1, 12), 0);
  assert.equal(menuOffset(0, 1, 12), 1);
  assert.equal(menuOffset(4, 1, 12), 5);
  assert.equal(menuOffset(5, 1, 12), 5);
  assert.equal(menuOffset(0, 1, 5), 0);
});

test('space timeline follows the diagonal scroll in the original map', () => {
  assert.deepEqual(spacePoint({ x: 470, y: 184 }, 0), { x: 72, y: 44 });
  assert.deepEqual(spacePoint({ x: 470, y: 184 }, 100), { x: 39, y: 127 });
  assert.deepEqual(spacePoint({ x: 520, y: 214 }, 50), { x: 105, y: 115 });
  assert.deepEqual(spacePoint({ x: 470, y: 184 }, 120), { x: 39, y: 127 });
});

test('each document subject, page and presentation resolves to bundled media', async () => {
  const [topics, assets, astronomy, catalog] = await Promise.all(
    ['topics', 'assets', 'astronomy', 'catalog'].map(data),
  );
  const image = (key) => assert.ok(assets.images[key], `missing image ${key}`);
  const media = (key) => assert.ok(assets.media[key], `missing media ${key}`);
  assert.equal(catalog.length, 12);
  assert.equal(topics.animal.zones.length, 24);
  assert.equal(topics.cycle.zones.length, 6);
  assert.equal(topics.espace.zones.length, 9);
  for (const entry of catalog.filter((e) => e.route))
    assert.ok(topics[entry.id] || nativeDocuments[entry.id] || ['atlas', 's16'].includes(entry.id));
  for (const topic of Object.values(topics)) {
    image(topic.background);
    if (topic.mask) image(topic.mask);
    if (topic.ambience) media(topic.ambience);
    media(topic.help);
    for (const key of topic.intro) media(key);
    assert.equal(new Set((topic.zones || []).map((z) => z.color)).size, (topic.zones || []).length);
    for (const zone of topic.zones || []) {
      if (zone.media) {
        media(zone.media);
        assert.equal(assets.media[zone.media].type, 'video');
      }
      if (zone.hoverAudio) media(zone.hoverAudio);
    }
  }
  assert.deepEqual(
    topics.planete.tabs.map((t) => t.id),
    [1, 2, 3, 5, 4, 6],
  );
  assert.equal(Object.keys(topics.planete.pages).length, 60);
  for (const planet of topics.planete.zones)
    for (const tab of topics.planete.tabs) {
      const page = topics.planete.pages[planet.id * 100 + tab.id];
      assert.ok(page, `${planet.label}/${tab.label}`);
      image(page.image);
      media(page.audio);
    }
  assert.equal(astronomy.skies.length, 8);
  for (const sky of astronomy.skies) {
    [sky.background, sky.mask, sky.figures, sky.lines, sky.outline].forEach(image);
    assert.ok(sky.zones.length > 0);
    for (const zone of sky.zones) {
      media(zone.audio);
      assert.ok(zone.rect[2] > 0 && zone.rect[3] > 0);
      const atlas = assets.images[sky.figures];
      assert.ok(
        zone.crop[0] + zone.rect[2] <= atlas.width && zone.crop[1] + zone.rect[3] <= atlas.height,
        `constellation atlas: ${zone.label}`,
      );
    }
  }
  for (const item of [...Object.values(assets.images), ...Object.values(assets.media)])
    for (const url of new Set([item.src, item.audio].filter(Boolean))) {
      assert.ok(url.startsWith('/game/documents/'));
      assert.ok((await readFile(new URL('../public' + url, import.meta.url))).length > 0, url);
    }
});
