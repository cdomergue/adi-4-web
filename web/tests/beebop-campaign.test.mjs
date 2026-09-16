import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGame, launch, movePaddle, step, won } from '../public/features/games/beebop/engine.js';
import { requiredPatternOffsets } from '../public/features/games/beebop/level-rules.js';

const base = new URL('../public/game/beebop1/', import.meta.url);
const campaign = JSON.parse(readFileSync(new URL('campaign.json', base)));
const artwork = JSON.parse(readFileSync(new URL('artwork.json', base)));

test('BeeBop I bundles the original 45-tableau order, patterns, graphics and PCM sounds', () => {
  assert.throws(() => createGame({ ...campaign, episode: 2 }), /Unsupported BeeBop ruleset/);
  assert.equal(campaign.levels.length, 45);
  assert.equal(campaign.levels[0].internalId, 31);
  assert.equal(new Set(campaign.levels.map(l => l.internalId)).size, 45);
  assert.equal(campaign.levels[2].leftInset, 30);
  assert.equal(campaign.levels[2].rightInset, 330);
  for (const level of campaign.levels) {
    assert.equal(level.cells.length, 160);
    assert.match(level.cells, /^[0-7A-Wb]+$/);
    assert.ok(artwork.bitmaps[level.backgroundBitmap]);
    for (const key of requiredPatternOffsets(level.internalId)) {
      assert.equal((campaign.patterns[key] ?? campaign.patterns[`0x${key.toString(16)}`]).length, 160);
    }
  }
  for (const [group, assets] of Object.entries(artwork)) {
    if (!['bitmaps', 'icons', 'sounds'].includes(group)) continue;
    for (const item of Object.values(assets)) {
      assert.match(item.path, /^(bitmaps|icons|sounds)\/[\w-]+\.(png|wav)$/);
      const bytes = readFileSync(new URL(item.path, base));
      if (group === 'sounds') {
        assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
        assert.equal(bytes.readUInt16LE(20), 1); // Uncompressed Windows PCM.
      } else {
        assert.equal(bytes.toString('hex', 0, 8), '89504e470d0a1a0a');
        assert.equal(bytes.readUInt32BE(16), item.width);
        assert.equal(bytes.readUInt32BE(20), item.height);
      }
    }
  }
});

test('each tableau runs through the integrated engine without missing transition data', () => {
  const source = JSON.stringify(campaign);
  for (let i = 0; i < campaign.levels.length; i++) {
    const state = createGame(campaign, i);
    assert.equal(state.lives, 8);
    assert.equal(state.phase, 'ready');
    assert.equal(won(state), false);
    for (let tick = 0; tick < 2000; tick++) {
      step(state, { x: 15 + tick % 450, fire: true }, campaign.patterns);
      for (const value of Object.values(state.ball)) assert.ok(Number.isInteger(value));
      assert.equal(state.cells.length, 160);
      assert.ok(state.lives >= -1);
    }
  }
  assert.equal(JSON.stringify(campaign), source, 'campaign data remains immutable');
});

test('first serve is free, ninth loss ends game, and loss retains animation position', () => {
  const state = createGame(campaign);
  state.cells.fill('0');
  state.targetCells.fill('1');
  for (let count = 0; count < 9; count++) {
    assert.equal(launch(state), true);
    Object.assign(state.ball, { x: 50, y: 290, dx: 0, dy: 2 });
    state.paddle.x = 400;
    step(state);
    assert.equal(state.lives, 7 - count);
    assert.deepEqual(state.events.find(e => e.type === 'loss'), { type: 'loss', x: 50, y: 290 });
    assert.equal(state.phase, count === 8 ? 'gameover' : 'ready');
  }
  const frozen = structuredClone(state.ball);
  assert.equal(launch(state), false);
  step(state, { x: 200, fire: true });
  assert.deepEqual(state.ball, frozen);
});

test('win grants reserve times ten exactly once', () => {
  const state = createGame(campaign, 0, { score: 13, lives: 4 });
  launch(state);
  state.cells = [...state.targetCells];
  Object.assign(state.ball, { x: 240, y: 240, dx: 0, dy: -2 });
  step(state, {}, campaign.patterns);
  assert.equal(state.phase, 'won');
  assert.equal(state.score, 53);
  step(state, { fire: true });
  assert.equal(state.score, 53);
});

test('paddle bounds and laser preserve native state across a reserve loss', () => {
  const state = createGame(campaign, 2);
  movePaddle(state, -1000);
  assert.equal(state.paddle.x, 45);
  movePaddle(state, 1000);
  assert.equal(state.paddle.x, 125);
  state.laser = true;
  launch(state);
  state.lost = true;
  step(state, {}, campaign.patterns);
  assert.equal(state.laser, true);
  assert.equal(state.phase, 'ready');
  assert.equal(state.ball.y, state.paddle.y - 22);
});
