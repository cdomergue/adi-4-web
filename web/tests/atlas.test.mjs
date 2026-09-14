import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import {
  createAtlas,
  pan,
  zoom,
  screenPoint,
  visibleMedia,
  selectTopic,
} from '../public/features/documents/atlas/engine.js';
const base = new URL('../public/game/documents/atlas/', import.meta.url);
const maps = JSON.parse(await readFile(new URL('maps.json', base), 'utf8'));
const media = JSON.parse(await readFile(new URL('media.json', base), 'utf8'));

test('Atlas zoom projects the clicked region into the original detailed map', () => {
  const overview = { ...createAtlas(), level: 4, x: 30 };
  const point = { x: 345, y: 170 },
    detailed = zoom(overview, 1, point);
  assert.equal(detailed.level, 5);
  const target = { x: ((30 + 345) * 2688) / 748, y: (170 * 1728) / 480 };
  const projected = screenPoint(target, detailed);
  assert.ok(Math.abs(projected.x - 320) < 1e-9);
  assert.ok(Math.abs(projected.y - 240) < 1e-9);
  assert.equal(zoom(detailed, 1), detailed);
  assert.equal(zoom(createAtlas(), -1).level, 3);
});
test('Atlas scrolling wraps horizontally and stops at both poles', () => {
  const detailed = { ...createAtlas(), level: 5 };
  assert.equal(pan(detailed, -10, -999).x, 2678);
  assert.equal(pan(detailed, -10, -999).y, 0);
  assert.equal(pan(detailed, 2688 * 3 + 12, 9999).x, 12);
  assert.equal(pan(detailed, 0, 9999).y, 1248);
  assert.equal(pan({ ...detailed, level: 4 }, 0, 200).y, 0);
});
test('Original media coordinates follow zoom and wrapping including seam overlaps', () => {
  const topic = { points: [{ id: 'EG_030', x: 1118, y: 279, type: 1 }] };
  const state = { ...createAtlas(), level: 4 };
  const [icon] = visibleMedia(topic, state);
  assert.equal(icon.left, (1118 * 748) / 2688 - 25);
  assert.equal(icon.top, (279 * 480) / 1728 - 21);
  assert.equal(visibleMedia(topic, { ...state, media: false }).length, 0);
  assert.equal(visibleMedia(topic, createAtlas()).length, 0);
  const nearSeam = { points: [{ id: 'edge', x: 2678, y: 300, type: 3 }] };
  assert.ok(visibleMedia(nearSeam, { ...state, level: 5 }).some((p) => p.left === -35));
});
test('Overview uses five source hotspots and detail exposes the full theme', () => {
  const topic = maps.topics[0];
  assert.equal(visibleMedia(topic, { ...createAtlas(), level: 4 }).length, 5);
  assert.equal(topic.points.length, 26);
  assert.deepEqual(
    maps.topics.map((t) => t.id),
    [41, 71, 75, 81, 82],
  );
  const selected = selectTopic({ ...createAtlas(), overlay: 54 }, maps.topics[1]);
  assert.equal(selected.topic, 71);
  assert.equal(selected.overlay, null);
});
test('Every map, legend, overlay and clickable media is bundled independently of ScummVM', async () => {
  const paths = new Set();
  for (const topic of maps.topics) {
    assert.ok(maps.maps[topic.map]);
    for (const id of topic.overlays) assert.ok(maps.overlays[id], String(id));
    for (const point of topic.points) {
      const entry = media.catalogue.find((e) => e.id === point.id);
      assert.ok(entry?.media?.src, point.id);
      assert.ok(entry.title, point.id);
      await access(new URL(`../public${entry.media.src}`, import.meta.url));
    }
  }
  function collect(value) {
    if (typeof value === 'string' && /\.(webp|png)$/.test(value)) paths.add(value);
    else if (value && typeof value === 'object') Object.values(value).forEach(collect);
  }
  collect(maps);
  for (const path of paths) await access(new URL(path, base));
  for (const layer of Object.values(maps.maps)) {
    assert.ok(layer.overview);
    assert.ok(layer.detail);
    assert.ok(layer.legends.overview.length);
    assert.ok(layer.legends.detail.length);
  }
});
