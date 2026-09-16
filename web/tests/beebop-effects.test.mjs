import test from 'node:test';
import assert from 'node:assert/strict';
import { hitBrick, tickEffects, tickIdle } from '../public/features/games/beebop/effects.js';

function game() {
  return {
    ball: { x: 400, y: 250, dx: -2, dy: -1 },
    paddle: { x: 100, y: 280, width: 40, leftInset: 5, rightInset: 35 },
    bounds: { left: 15, right: 495, top: 11, bottom: 306 },
    cells: Array(160).fill('0'), targetCells: Array(160).fill('0'),
    enemy: null, enemyEnabled: false, missile: null, laser: false, lives: 8, score: 0,
    idleTicks: 40, tick: 0, lost: false, events: [],
  };
}

test('ball brick rules: resistant stages, score, laser, extra reserve and original sounds', () => {
  const state = game();
  state.cells[12] = 'Z';
  for (const [kind, next, score] of [['Z', 'Y', 0], ['Y', '1', 0], ['1', '0', 1]]) {
    hitBrick(state, 12, kind);
    assert.equal(state.cells[12], next);
    assert.equal(state.score, score);
    assert.equal(state.idleTicks, 0);
  }
  state.cells[13] = 'b';
  hitBrick(state, 13, 'b');
  assert.equal(state.lives, 9);
  state.cells[14] = '7';
  hitBrick(state, 14, '7');
  assert.equal(state.laser, true);
  assert.equal(state.score, 3);
  assert.deepEqual(state.events.filter(e => e.type === 'sound').map(e => e.sound), ['bip', 'key', 'bop']);
  assert.deepEqual(state.events.filter(e => e.type === 'brick').map(e => e.kind), ['Z', 'Y', '1', 'b', '7']);
  assert.deepEqual(state.targetCells, Array(160).fill('0'));
  hitBrick(state, 14, '7');
  assert.equal(state.score, 3);
});

test('held fire produces one missile, stationary on spawn and moving 15px thereafter', () => {
  const state = game();
  tickEffects(state, true);
  assert.equal(state.missile, null);
  state.laser = true;
  tickEffects(state, true);
  assert.deepEqual(state.missile, { x: 118, y: 265 });
  tickEffects(state, true);
  assert.deepEqual(state.missile, { x: 118, y: 250 });
  assert.deepEqual(state.events, [{ type: 'sound', sound: 'missil' }]);
  state.missile.y = 40;
  tickEffects(state, true);
  assert.equal(state.missile, null);
  tickEffects(state, true);
  assert.equal(state.events.length, 2);
});

function aimedShot(leftKind, rightKind = '0') {
  const state = game();
  state.laser = true;
  // After movement y=80, sample y-top-15+1=55 => row 1.
  // x-left=30 maps to column 0 inclusively; x-left+6 maps to column 1.
  state.missile = { x: 45, y: 95 };
  state.cells[16] = leftKind;
  state.cells[17] = rightKind;
  return state;
}

test('missile destroys one normal brick but two corners when a 7 is present', () => {
  const normal = aimedShot('1', '1');
  tickEffects(normal);
  assert.deepEqual(normal.cells.slice(16, 18), ['0', '1']);
  assert.equal(normal.score, 1);
  const special = aimedShot('7', '1');
  tickEffects(special);
  assert.deepEqual(special.cells.slice(16, 18), ['0', '0']);
  assert.equal(special.score, 2);
  assert.deepEqual(special.events.filter(e => e.type === 'brick'), [
    { type: 'brick', index: 16, kind: '7' }, { type: 'brick', index: 17, kind: '1' },
  ]);
});

test('missile blocks on life bricks and solids, and wears down resistant bricks without score', () => {
  for (const kind of ['b', '2', '5']) {
    const state = aimedShot(kind);
    tickEffects(state);
    assert.equal(state.cells[16], kind);
    assert.equal(state.missile, null);
    assert.equal(state.lives, 8);
    assert.equal(state.score, 0);
    assert.equal(state.idleTicks, 40);
  }
  for (const [kind, next] of [['Z', 'Y'], ['Y', '1']]) {
    const state = aimedShot(kind);
    tickEffects(state);
    assert.equal(state.cells[16], next);
    assert.equal(state.missile, null);
    assert.equal(state.score, 0);
    assert.equal(state.idleTicks, 0);
  }
  const mixed = aimedShot('Z', 'Y');
  tickEffects(mixed);
  assert.deepEqual(mixed.cells.slice(16, 18), ['Z', '1']);
});

test('a shot sampling the same 7 twice scores once', () => {
  const state = aimedShot('7');
  state.missile.x = 20;
  tickEffects(state);
  assert.equal(state.score, 1);
  assert.equal(state.events.filter(e => e.type === 'brick').length, 1);
});

test('missile-ball interaction reverses only descending balls, including distant vertical overlap', () => {
  for (const dy of [-2, 2]) {
    const state = game();
    state.laser = true;
    state.missile = { x: 200, y: 100 };
    state.ball = { x: 198, y: 240, dx: 1, dy };
    tickEffects(state);
    assert.equal(state.missile, null);
    assert.equal(state.ball.dy, -2);
    assert.equal(state.idleTicks, dy > 0 ? 0 : 40);
  }
});

test('enemy absorbs a missile but keeps moving without score or life changes', () => {
  const state = game();
  state.enemyEnabled = true;
  state.enemy = { x: 100, y: 100, dx: 1 };
  state.laser = true;
  state.missile = { x: 110, y: 145 };
  tickEffects(state);
  assert.equal(state.missile, null);
  assert.deepEqual(state.enemy, { x: 101, y: 100, dx: 1 });
  assert.equal(state.score, 0);
  assert.equal(state.lives, 8);
});

test('enemy tests strict ball corners before moving and only signals loss', () => {
  const state = game();
  state.enemyEnabled = true;
  state.enemy = { x: 100, y: 100, dx: 1 };
  state.ball = { x: 81, y: 104, dx: 1, dy: -2 };
  tickEffects(state);
  assert.equal(state.lost, false); // x+19 equals boundary, y-4 equals boundary.
  state.ball.x = 83;
  tickEffects(state);
  assert.equal(state.lost, true);
  assert.equal(state.lives, 8);
  assert.equal(state.enemy.x, 102);
});

test('enemy reverses against sampled 1/2/3/4 cells, not Z/Y/b/7, then enforces bounds', () => {
  for (const kind of ['1', '2', '3', '4', 'Z', 'Y', 'b', '7']) {
    const state = game();
    state.enemyEnabled = true;
    state.enemy = { x: 100, y: 41, dx: 1 };
    state.cells[18] = kind; // trunc((101-15-5)/30)=2, row=1.
    tickEffects(state);
    assert.equal(state.enemy.dx, '1234'.includes(kind) ? -1 : 1);
  }
  const state = game();
  state.bounds.left = 105;
  state.enemyEnabled = true;
  state.bounds.right = 405;
  state.enemy = { x: 369, y: 41, dx: 1 };
  tickEffects(state);
  assert.equal(state.enemy.dx, -1);
  state.enemy.x = 107;
  tickEffects(state);
  assert.equal(state.enemy.dx, 1);
});

test('idle correction has exact 1000-tick threshold and native direction cycle', () => {
  for (const [dx, next, dy] of [[-2, -1, 2], [-1, 1, 2], [1, 2, 1], [2, -2, 1], [0, -2, 1]]) {
    const state = game();
    state.ball.dx = dx;
    state.ball.dy = 1;
    state.idleTicks = 999;
    tickIdle(state);
    assert.equal(state.ball.dx, dx);
    state.idleTicks += 1;
    tickIdle(state);
    assert.equal(state.ball.dx, next);
    assert.equal(state.ball.dy, dy);
    assert.equal(state.idleTicks, 0);
    state.idleTicks = 1001;
    tickIdle(state);
    assert.equal(state.idleTicks, 1001);
  }
});

test('inactive enemies neither move nor kill nor absorb shots, including at the left wall', () => {
  for (const enable of [state => {}, state => { state.enemy.dx = 1; },
    state => { delete state.enemyEnabled; state.enemy.dx = 1; }]) {
    const state = game();
    state.enemy = { x: 15, y: 100, dx: 0 };
    state.ball = { x: 19, y: 104, dx: 1, dy: -2 };
    enable(state);
    tickEffects(state);
    assert.equal(state.lost, false);
    assert.equal(state.enemy.x, 15);
    state.ball.x = 400;
    state.laser = true;
    state.missile = { x: 20, y: 145 };
    tickEffects(state);
    assert.deepEqual(state.missile, { x: 20, y: 130 });
    assert.equal(state.enemy.x, 15);
  }
});

test('ready moves enabled enemies but cannot collide, shoot or advance a missile', () => {
  const state = game();
  state.enemyEnabled = true;
  state.phase = 'ready';
  state.enemy = { x: 100, y: 100, dx: 1 };
  state.ball = { x: 104, y: 104, dx: 0, dy: -2 };
  state.laser = true;
  tickEffects(state, true);
  assert.equal(state.enemy.x, 101);
  assert.equal(state.lost, false);
  assert.equal(state.missile, null);
  state.missile = { x: 110, y: 145 };
  tickEffects(state, true);
  assert.deepEqual(state.missile, { x: 110, y: 145 });
  assert.deepEqual(state.events, []);
});

test('enemyEnabled enables contact independently of zero direction', () => {
  const state = game();
  state.enemyEnabled = true;
  state.enemy = { x: 100, y: 100, dx: 0 };
  state.ball = { x: 104, y: 104, dx: 1, dy: -2 };
  tickEffects(state);
  assert.equal(state.lost, true);
  assert.deepEqual(state.enemy, { x: 100, y: 100, dx: 0 });
});
