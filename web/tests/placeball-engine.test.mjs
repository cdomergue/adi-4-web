import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createGame, step, launch, selectLauncher, checkpoint, readCheckpoint,
  index, CELL_CODES, SPEEDS } from '../public/features/games/placeball/engine.js';

const campaign = JSON.parse(readFileSync(new URL('../public/game/placeball/campaign.json', import.meta.url)));
const native = JSON.parse(readFileSync(new URL('./fixtures/placeball-native.json', import.meta.url)));
const artwork = JSON.parse(readFileSync(new URL('../public/game/placeball/artwork.json', import.meta.url)));

test('576 original x86 collision vectors, including alignment, carry and 32-bit overflow', () => {
  assert.equal(native.provenance.executableSha256, artwork.executableSha256);
  assert.equal(native.cases.length, 576);
  for (const { input, expected } of native.cases) {
    const state = createGame(campaign);
    state.board.fill(0); state.holes = 2; state.prizes = 9; state.lives = 4;
    state.phase = 'moving'; state.speed = 1;
    state.difficulty = input.difficulty; state.score = input.score;
    const dx = [0, 0, 1, 0, -1][input.direction], dy = [0, -1, 0, 1, 0][input.direction];
    state.ball = { x: 120 + input.misaligned - dx * 2, y: 144 - dy * 2, direction: input.direction };
    state.board[index(5, 6)] = input.cell;
    step(state);
    assert.deepEqual({ cell: state.board[index(5, 6)], direction: state.ball?.direction ?? input.direction,
      score: state.score, holes: state.holes, prizes: state.prizes }, expected, JSON.stringify(input));
  }
});

test('PBWIN campaign uses numeric puzzle IDs, all 26×16 cells and per-board reserves', () => {
  assert.equal(campaign.levels.length, 15);
  assert.deepEqual(CELL_CODES, [0,700,400,401,402,403,100,200,201,600,601,602,603,604,300,500,501,502,0,0]);
  for (const [i, level] of campaign.levels.entries()) {
    const state = createGame(campaign, i), raw = level.columns.flatMap(c => c.match(/../g).map(Number));
    assert.equal(level.number, i + 1);
    assert.equal(state.board.length, 416);
    assert.equal(state.lives, raw.filter(c => c === 1).length);
    assert.equal(state.holes, raw.filter(c => c === 6).length);
    assert.equal(state.prizes, raw.filter(c => c >= 15 && c <= 17).length);
    assert.ok(state.launchers.length > 0 && state.lives > 0 && state.holes > 0);
    assert.ok(!state.board.includes(700));
  }
  assert.equal(createGame(campaign).lives, 1);
  assert.deepEqual(createGame(campaign).launchers, [index(20, 14), index(5, 14)]);
});

function shortLevel(cells, lives = 3, difficulty = 0) {
  const state = createGame(campaign, 0, { difficulty, speed: 5 });
  state.board.fill(0); state.board[index(1, 1)] = 401;
  for (const [x, cell] of cells) state.board[index(x, 1)] = cell;
  state.launchers = [index(1, 1)]; state.selected = 0;
  state.lives = lives; state.holes = cells.filter(([,c]) => c === 100).length;
  state.prizes = cells.filter(([,c]) => c >= 500 && c < 600).length;
  return state;
}

test('launch consumes one sphere; holes consume it and completion wins on the last sphere', () => {
  const state = shortLevel([[2, 100]], 1);
  assert.equal(launch(state, index(0, 0)), false);
  assert.equal(launch(state), true); assert.equal(state.lives, 0);
  assert.equal(launch(state), false);
  step(state);
  assert.equal(state.phase, 'won'); assert.equal(state.score, 1250); assert.equal(state.ball, null);
  for (let i = 0; i < 16; i++) step(state);
  assert.equal(state.phaseTime, 400); assert.equal(state.score, 1250);
});

test('Challenge requires prizes as well as holes and doubles score', () => {
  const state = shortLevel([[2, 100], [3, 500]], 3, 1);
  launch(state); step(state);
  assert.equal(state.phase, 'ready'); assert.equal(state.score, 500);
  launch(state); step(state); step(state);
  assert.equal(state.phase, 'won'); assert.equal(state.score, 2700);
});

test('bombs are destroyed, launchers persist, death lasts 1400 ms and cannot be interrupted', () => {
  for (const cell of [300, 401]) {
    const state = shortLevel([[2, cell], [3, 100]], 2);
    launch(state); step(state);
    assert.equal(state.phase, 'dying'); assert.equal(state.board[index(2, 1)], cell === 300 ? 0 : cell);
    assert.equal(launch(state), false);
    for (let i = 0; i < 55; i++) step(state);
    assert.equal(state.phase, 'dying'); step(state); assert.equal(state.phase, 'ready');
    assert.equal(state.lives, 1);
  }
});

test('exhaustion rolls back only this level’s score; restart restores all board state', () => {
  const state = shortLevel([[2, 500], [3, 300], [4, 100]], 1);
  state.startScore = 600; state.score = 600;
  launch(state); step(state); assert.equal(state.score, 700); step(state);
  for (let i = 0; i < 56; i++) step(state);
  assert.equal(state.phase, 'gameover'); assert.equal(state.score, 600);
  const restored = createGame(campaign, 0, checkpoint(state));
  assert.equal(restored.score, 600); assert.equal(restored.lives, 1);
});

test('speed changes wait until a cell boundary and every speed reaches exact centers', () => {
  for (let speed = 1; speed <= 5; speed++) {
    const state = shortLevel([[3, 100]]);
    state.speed = speed; launch(state);
    for (let i = 0; i < 48 / SPEEDS[speed]; i++) step(state);
    assert.equal(state.phase, 'won');
  }
  const state = shortLevel([[4, 100]]); state.speed = 1; launch(state); step(state);
  state.pendingSpeed = 5;
  for (let i = 0; i < 11; i++) step(state);
  assert.equal(state.speed, 1); step(state); assert.equal(state.speed, 5);
});

test('selection wraps; selection and relaunch are disabled during flight', () => {
  const state = createGame(campaign);
  selectLauncher(state, -1); assert.equal(state.selected, 1);
  selectLauncher(state, 1); assert.equal(state.selected, 0);
  launch(state); selectLauncher(state, 1); assert.equal(state.selected, 0);
});

test('checkpoint validation rejects malformed, out-of-range and incompatible saves', () => {
  const good = checkpoint(createGame(campaign, 3, { score: 1234, difficulty: 1, speed: 2 }));
  assert.deepEqual(readCheckpoint(good, campaign), good);
  for (const value of [null, {}, { ...good, levelIndex: -1 }, { ...good, levelIndex: 15 },
    { ...good, score: -1 }, { ...good, score: 2 ** 32 }, { ...good, speed: 1.5 },
    { ...good, difficulty: 2 }]) assert.equal(readCheckpoint(value, campaign), null);
});

test('all bundled sounds retain their extracted RIFF bytes', () => {
  for (const [id, sha] of Object.entries(artwork.sounds)) {
    const data = readFileSync(new URL(`../public/game/placeball/sound-${id}.wav`, import.meta.url));
    assert.equal(data.toString('ascii', 0, 4), 'RIFF');
    assert.equal(data.length, data.readUInt32LE(4) + 8);
    assert.equal(createHash('sha256').update(data).digest('hex'), sha);
  }
});

test('every original launcher remains inside the board during a bounded native-speed trace', () => {
  for (let level = 0; level < 15; level++) {
    const initial = createGame(campaign, level, { speed: 5 });
    for (const launcher of initial.launchers) {
      const state = createGame(campaign, level, { speed: 5 }); launch(state, launcher);
      for (let t = 0; t < 2000 && state.phase === 'moving'; t++) {
        step(state);
        if (state.ball) assert.ok(state.ball.x >= 0 && state.ball.x < 624 &&
          state.ball.y >= 0 && state.ball.y < 384, `level=${level + 1}, launcher=${launcher}`);
      }
    }
  }
});
