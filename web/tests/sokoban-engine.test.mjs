import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startLevel, move, won, tileAt } from '../public/features/games/sokoban/engine.js';
const board = (cells) => startLevel({ width: cells.length, height: 1, boxes: 1, cells });
test('push onto and off a goal preserves the floor and prevents pulling', () => {
  const initial = board([300, 1, 400, 100, 200, 300]);
  const pushed = move(initial, 1, 0);
  assert.equal(pushed.cells[3], 500);
  assert.equal(pushed.cells[2], 200);
  assert.ok(won(pushed));
  assert.equal(initial.cells[2], 400);
  assert.equal(pushed.pushes, 1);
  const off = move(board([300, 1, 500, 200, 100, 300]), 1, 0);
  assert.equal(off.cells[2], 100);
  assert.equal(off.cells[3], 400);
  assert.ok(!won(off));
  const back = move(off, -1, 0);
  assert.equal(back.cells[3], 400);
  assert.equal(back.pushes, 1);
});
test('walls, double crates and board edges cannot be crossed', () => {
  for (const cells of [
    [1, 300, 100],
    [1, 400, 400, 100],
    [1, 400, 300, 100],
  ]) {
    const s = board(cells);
    assert.equal(move(s, 1, 0), s);
    assert.equal(move(s, -1, 0), s);
  }
});
test('native atlas mapping and budget are preserved', () => {
  const s = board([1, 400, 100]);
  assert.equal(s.remaining, 120);
  assert.equal(tileAt(s, 0), 18);
  assert.equal(tileAt(s, 1), 16);
  assert.equal(tileAt(s, 2, 2), 2);
  const after = move(s, 1, 0);
  assert.equal(after.remaining, 119);
  assert.equal(after.moves, 1);
});
test('all fifteen original levels have valid tiles, balanced goals and one player', () => {
  const { levels } = JSON.parse(
    readFileSync(new URL('../public/game/sokoban/levels.json', import.meta.url)),
  );
  assert.equal(levels.length, 15);
  for (const l of levels) {
    assert.equal(l.cells.length, 416);
    assert.equal(l.cells.filter((v) => v < 100).length, 1);
    const s = startLevel(l);
    assert.ok(!won(s));
    for (let i = 0; i < 416; i++) assert.ok(tileAt(s, i) >= 0 && tileAt(s, i) <= 20);
    for (const delta of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const n = move(s, ...delta);
      assert.equal(n.cells.filter((v) => [4, 5].includes(Math.floor(v / 100))).length, l.boxes);
    }
  }
});
