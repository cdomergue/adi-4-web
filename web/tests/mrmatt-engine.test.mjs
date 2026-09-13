import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  startLevel,
  move,
  won,
  replayMoves,
  WIDTH,
  HEIGHT,
  TILE,
} from '../public/features/games/mrmatt/engine.js';

const data = JSON.parse(
  readFileSync(new URL('../public/game/mrmatt1/levels.json', import.meta.url)),
);
for (const [episode, expected] of [[1, 25], [2, 34]]) test(`Mr. Matt ${episode}: ${expected} valid original SOX solutions finish in exactly their recorded number of moves`, () => {
  const campaign = JSON.parse(readFileSync(new URL(`../public/game/mrmatt${episode}/levels.json`, import.meta.url)));
  let count = 0;
  for (const pack of campaign.packs)
    for (const level of pack.levels) {
      // The original Win32 rules also reject this supplied solution at move 395.
      // Its entire native replay is checked separately below.
      if (episode === 2 && pack.id === 'TRY_THIS' && level.id === 7) {
        assert.throws(() => replayMoves(level, level.solution.moves), /Impossible saved move/);
        continue;
      }
      const state = replayMoves(level, level.solution.moves);
      assert.ok(won(state), `${pack.id}/${level.id}: ${state.remaining} food left`);
      assert.equal(state.moves, level.solution.count);
      assert.equal(state.dead, false);
      assert.equal(state.cells.filter((v) => v === TILE.FOOD).length, 0);
      let assisted = startLevel(level);
      for (const direction of level.solution.moves)
        assisted = move(assisted, direction, { noStupidMoves: true });
      assert.ok(won(assisted));
      assert.equal(assisted.moves, level.solution.count);
      count++;
    }
  assert.equal(count, expected);
});

test('Mr. Matt II matches every native board for all 35 supplied solutions, including the broken original', () => {
  const campaign = JSON.parse(readFileSync(new URL('../public/game/mrmatt2/levels.json', import.meta.url)));
  const native = JSON.parse(readFileSync(new URL('./fixtures/mrmatt2-native.json', import.meta.url)));
  assert.equal(native.levels.length, 35);
  for (const reference of native.levels) {
    const level = campaign.packs.find((p) => p.id === reference.pack).levels.find((l) => l.id === reference.level);
    let state = startLevel(level);
    const hash = createHash('sha256');
    for (const direction of level.solution.moves) {
      state = move(state, direction);
      hash.update(Uint8Array.from(state.cells));
    }
    assert.equal(hash.digest('hex'), reference.boardsSha256, `${reference.pack}/${reference.level}`);
    assert.equal(state.remaining, reference.remaining);
  }
});

function board(rows) {
  const cells = Array(WIDTH * HEIGHT).fill(TILE.WALL);
  const map = { ' ': 0, '-': 1, '#': 2, '*': 3, '+': 4, '=': 7, H: 9 };
  rows.forEach((row, y) => [...row].forEach((c, x) => (cells[y * WIDTH + x] = map[c])));
  cells[cells.length - 1] = TILE.FOOD; // Keep this test board unfinished.
  return { cells };
}
const cell = (state, x, y) => state.cells[y * WIDTH + x];
test('digging releases only the stone over the vacated square, and cascades up the column', () => {
  const initial = startLevel(board(['#*##*#', '#*## #', '#H-# #', '#  ###', '######']));
  const state = move(initial, 'R');
  assert.equal(cell(state, 1, 1), 0);
  assert.equal(cell(state, 1, 2), 3);
  assert.equal(cell(state, 1, 3), 3);
  assert.equal(cell(state, 4, 0), 3); // Unrelated suspended stone never ticks.
  assert.equal(initial.cells[WIDTH * 2 + 1], 9); // Immutable input.
});
test('a moving stone kills Matt from the square above; optional protection blocks that step', () => {
  const initial = startLevel(board(['#*#', '#H#', '#-#', '###']));
  assert.equal(move(initial, 'D', { noStupidMoves: true }), initial);
  const state = move(initial, 'D');
  assert.ok(state.dead);
  assert.equal(cell(state, 1, 2), 10);
  assert.equal(move(state, 'U'), state);
});
test('stones can be pushed horizontally into air only, one at a time', () => {
  let initial = startLevel(board(['######', '#H*  #', '######']));
  const state = move(initial, 'R');
  assert.equal(cell(state, 3, 1), 3);
  assert.equal(state.player, WIDTH + 2);
  initial = startLevel(board(['######', '#H** #', '######']));
  assert.equal(move(initial, 'R'), initial);
  initial = startLevel(board(['######', '#H*- #', '######']));
  assert.equal(move(initial, 'R'), initial);
});
test('an impact consumes the falling stone and weakens a wooden crate', () => {
  const state = move(startLevel(board(['#####', '#*###', '#H-##', '#=###', '#####'])), 'R');
  assert.equal(cell(state, 1, 1), 0);
  assert.equal(cell(state, 1, 3), 6);
});
test('a stone rolls only after falling onto another stone, following the releasing move', () => {
  const state = move(
    startLevel(board(['#######', '###*###', '###H-##', '#     #', '#  *  #', '#######'])),
    'R',
  );
  assert.equal(cell(state, 4, 4), 3); // Right is selected when both sides are free.
  assert.equal(cell(state, 3, 4), 3);
});
test('save routes round-trip and reject corruption or impossible moves', () => {
  const level = data.packs[0].levels[0],
    route = level.solution.moves.slice(0, 30);
  assert.deepEqual(
    replayMoves(level, JSON.parse(JSON.stringify(route))),
    replayMoves(level, route),
  );
  for (const bad of [null, {}, 'L<script>', 'D'.repeat(16385)])
    assert.throws(() => replayMoves(level, bad));
  const blocked = board(['###', '#H#', '###']);
  assert.throws(() => replayMoves(blocked, 'R'));
  assert.throws(() => startLevel({ cells: [] }));
});
