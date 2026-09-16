import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  bouncePaddle,
  cellIndex,
  collideBricks,
  step,
} from '../public/features/games/beebop/engine.js';

// Expected values are CPU results from original BEEBOP1.EXE, not a JS oracle.
// See fixture.provenance for source hashes, seed, exact stub scope and ABI.
// The fixture includes segment hashes and the exact native/stub boundary.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/beebop1-native.json', import.meta.url)));

function stateFor(input) {
  return {
    ball: { ...input.ball },
    bounds: { ...input.bounds },
    paddle: { x: 200, y: 303, width: 40, leftInset: 0, rightInset: 0, ...input.paddle },
    cells: [...(input.cells ?? '0'.repeat(160))],
    // Deliberately unmatched target prevents an empty board from ending a frame.
    targetCells: Array(160).fill('1'),
    levelId: -1, level: {}, levelFlags: {}, flags: {},
    phase: 'playing', tick: 0, idleTicks: 37, score: 0, lives: 8, lost: false,
    laser: false, enemy: null, missile: null, events: [], explosions: [],
  };
}

function observe(state, input) {
  const result = {
    ball: integerBall(state.ball), lost: state.lost, idleTicks: state.idleTicks,
    score: state.score, lives: state.lives,
  };
  if (input.cells) {
    result.changedCells = state.cells.flatMap((c, i) => c === input.cells[i] ? [] : [[i, c]]);
  }
  return result;
}

// x86 signed integers have one zero; JS unary negation can produce -0.
function integerBall(ball) {
  return Object.fromEntries(Object.entries(ball).map(([key, value]) => [key, value + 0]));
}

function compareVectors(t, vectors, execute) {
  const failures = [];
  for (const vector of vectors) {
    const { actual, expected } = execute(vector);
    if (!isEqual(actual, expected)) {
      failures.push({ id: vector.id, input: vector.input, actual, expected });
    }
  }
  t.diagnostic(`${vectors.length} native vectors, ${failures.length} divergences`);
  assert.equal(failures.length, 0,
    `${failures.length}/${vectors.length} native divergences; first three:\n` +
    JSON.stringify(failures.slice(0, 3), null, 2));
}

function isEqual(actual, expected) {
  try {
    assert.deepEqual(actual, expected);
    return true;
  } catch (error) {
    if (error.code !== 'ERR_ASSERTION') throw error;
    return false;
  }
}

test('BeeBop I native fixture has reproducible provenance and complete coverage', () => {
  assert.equal(fixture.schemaVersion, 1);
  assert.equal(fixture.provenance.seed, 0xbeeb0001);
  assert.equal(fixture.provenance.unicornVersion, '2.1.4');
  assert.equal(fixture.provenance.dataSegment, '6000');
  assert.equal(Object.keys(fixture.provenance.segmentsSha256).length, 6);
  for (const hash of [fixture.provenance.executableSha256, fixture.provenance.generatorSha256,
    fixture.provenance.assemblySha256, ...Object.values(fixture.provenance.segmentsSha256)]) {
    assert.match(hash, /^[0-9a-f]{64}$/);
  }
  assert.equal(createHash('sha256').update(JSON.stringify(fixture.vectors)).digest('hex'),
    fixture.provenance.vectorsSha256);
  assert.equal(new Set(fixture.vectors.map(v => v.id)).size, fixture.vectors.length);
  assert.equal(fixture.provenance.fullVectorCount, 7703);
  assert.deepEqual(fixture.provenance.fullGroupCounts, { collisions: 4851, paddle: 2420, bounds: 432 });
  assert.deepEqual(fixture.provenance.nativeRoutineInvocations, {
    '1008:1645': 4851, '1008:24dd': 2420, '1008:0fa8': 2420, '1000:26ba': 432,
  });
  for (const [group, count] of Object.entries(fixture.provenance.selectedGroupCounts)) {
    assert.equal(fixture.vectors.filter(v => v.group === group).length, count);
    assert.ok(count >= 100);
  }
  assert.ok(readFileSync(new URL('./fixtures/beebop1-native.json', import.meta.url)).length < 400_000);
  assert.ok(fixture.provenance.executedInstructionCount > 1_000_000);
});

test('BeeBop I collision grid matches native inclusive, saturated corner sampling', t => {
  compareVectors(t, fixture.vectors.filter(v => v.group === 'collisions'), vector => {
    const state = stateFor(vector.input);
    const { x, y } = state.ball;
    return {
      actual: [[x - 3, y - 3], [x - 3, y + 18], [x + 18, y + 18], [x + 18, y - 3]]
        .map(([cx, cy]) => cellIndex(state, cx, cy)),
      expected: vector.trace.indices,
    };
  });
});

for (const [name, prefix] of [['single-kind masks', 'mask-'], ['mixed bricks', 'mixed-'],
  ['grid edges and duplicate corners', 'grid-edge-']]) {
  // Native 1008:1e83 and 1ea0 score independently: simultaneous b + 7 gives
  // two points although the life-brick pass alone destroys a cell (1aac).
  // Keep strict assertions here so this priority/score discrepancy stays visible.
  test(`BeeBop I collisions match 1008:1645: ${name}`, t => {
    compareVectors(t, fixture.vectors.filter(v => v.id.startsWith(prefix)), vector => {
      const state = stateFor(vector.input);
      collideBricks(state, vector.input.previous);
      return { actual: observe(state, vector.input), expected: vector.native };
    });
  });
}

test('BeeBop I paddle matches 1008:0fa8 and native soft-float zone thresholds', t => {
  compareVectors(t, fixture.vectors.filter(v => v.group === 'paddle'), vector => {
    const state = stateFor(vector.input);
    bouncePaddle(state);
    return { actual: observe(state, vector.input), expected: vector.native };
  });
});

test('BeeBop I frame bounds match 1000:26ba, including strict thresholds and loss', t => {
  compareVectors(t, fixture.vectors.filter(v => v.group === 'bounds'), vector => {
    const state = stateFor(vector.input);
    // step adds velocity before bounds. The fixture input is AFTER that addition.
    Object.assign(state.ball, vector.input.previous);
    // No paddle/brick/enemy contact: only bounds may alter the trajectory.
    state.paddle.x = 5000;
    state.paddle.y = 1000;
    step(state);
    const loss = state.events.some(e => e.type === 'loss');
    const actual = { loss, lives: state.lives, phase: state.phase, score: state.score };
    const expected = {
      loss: vector.native.lost, lives: vector.native.lost ? 7 : 8,
      phase: vector.native.lost ? 'ready' : 'playing', score: 0,
    };
    // On loss the public frame API serves a new ball; native 26ba only sets a flag.
    // Compare trajectory only before loss, and reserve/phase after loss.
    if (!vector.native.lost) {
      actual.ball = integerBall(state.ball);
      expected.ball = vector.native.ball;
    }
    return { actual, expected };
  });
});
