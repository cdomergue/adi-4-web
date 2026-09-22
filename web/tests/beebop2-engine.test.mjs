import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collideCells } from '../public/features/games/beebop2/collisions.js';
import { collidePaddle } from '../public/features/games/beebop2/paddle.js';
import { collideMissile, stepMissiles } from '../public/features/games/beebop2/missiles.js';
import { runLevelTransitions } from '../public/features/games/beebop2/generated/level-transitions.js';
import { openGate, isBallLost } from '../public/features/games/beebop2/level-rules.js';
import { createGame, step, movePaddle } from '../public/features/games/beebop2/engine.js';

const fixtures = JSON.parse(readFileSync(new URL('./fixtures/beebop2-native.json', import.meta.url)));
const sparse = cells => cells.flatMap((kind, i) => kind === 48 ? [] : [[i, kind]]);
const ruleFixtures = JSON.parse(readFileSync(new URL('./fixtures/beebop2-rules.json', import.meta.url)));
const campaign = JSON.parse(readFileSync(new URL('../public/game/beebop2/campaign.json', import.meta.url)));
const motions = JSON.parse(readFileSync(new URL('./fixtures/beebop2-motion.json', import.meta.url)));

test('BeeBop II: complete native missile salvos, including suppression and retirement', () => {
  const cases = JSON.parse(readFileSync(new URL('./fixtures/beebop2-salvos.json', import.meta.url)));
  for (const [index, { input, frames }] of cases.entries()) {
    const state = Object.assign(createGame(campaign), structuredClone(input), { paddle: { x:300, y:400, width:40 } });
    for (const [tick, expected] of frames.entries()) {
      state.events = [];
      stepMissiles(state, expected.fire);
      assert.deepEqual({ missiles:state.missiles, cells:state.cells, sy:state.ball.sy,
        score:state.score, fired:state.events.some(e => e.type === 'fire') },
      { missiles:expected.missiles, cells:expected.cells, sy:expected.sy,
        score:expected.score, fired:expected.fired }, `salvo ${index}, tick ${tick}`);
    }
  }
});

test('BeeBop II: complete three-substep trajectories match the native outer movement routine', () => {
  for (const [index, { input, expected }] of motions.entries()) {
    const state = createGame(campaign);
    state.paddle.x = 300;
    state.ball = { ...state.ball, ...input };
    state.phase = 'playing';
    for (let i = 0; i < 3; i++) step(state);
    const { x, y, sx, sy, pattern } = state.ball;
    assert.deepEqual({ x, y, sx, sy, pattern, cells: state.cells,
      score: state.score, weapon: state.weapon, lives: state.lives }, expected, `trajectory ${index}`);
  }
});

test('BeeBop II: every native death-line boundary', () => {
  for (const [stage, x, y, expected] of ruleFixtures.losses) {
    const rules = { ...campaign.levels.find(l => l.id === stage).config };
    if (stage === 17) rules['0d12'] = 0;
    assert.equal(isBallLost({ rules }, { x, y }), expected, `stage ${stage} at ${x},${y}`);
  }
});

test('BeeBop II: both original campaigns initialize and advance without invalid state', () => {
  for (const path of [0, 1]) for (let index = 0; index < 20; index++) {
    const state = createGame(campaign, index, { path });
    assert.equal(state.cells.length, 247);
    assert.equal(state.stage, campaign.paths[path][index]);
    assert.equal(state.lives, 6);
    assert.equal(state.rules['1216'], 0, 'reachable campaigns do not enable the unused multiball code');
    for (let tick = 0; tick < 3000; tick++) {
      step(state, { fire: true, x: state.ball.x - 20 });
      for (const value of [state.ball.x, state.ball.y, state.score, state.paddle.x, state.paddle.y]) assert.ok(Number.isFinite(value));
      assert.ok(state.ball.pattern >= 0 && state.ball.pattern <= 5);
    }
  }
});

test('BeeBop II: left-edge pointer, free first serve, six reserves, seven losses', () => {
  const state = createGame(campaign);
  movePaddle(state, 300);
  assert.equal(state.paddle.x, 300);
  assert.equal(state.ball.x, 320);
  for (let i = 0; i < 7; i++) {
    step(state, { fire: true });
    state.ball.y = 430;
    state.ball.x = 350;
    state.ball.sy = -1;
    step(state);
    assert.equal(state.lives, Math.max(0, 5 - i));
    assert.equal(state.phase, i === 6 ? 'gameover' : 'ready');
  }
});

test('BeeBop II: original gate rectangles and stage transitions', () => {
  for (const { stage, scenario, input, expected } of ruleFixtures.rules) {
    const state = { ...structuredClone(input), stage, events: [],
      level: campaign.levels.find(l => l.id === stage) };
    runLevelTransitions(state, openGate);
    assert.deepEqual({ rules: state.rules, cells: state.cells, targetCells: state.targetCells },
      expected, `stage ${stage}, ${scenario}`);
  }
});

test('BeeBop II: missile probes match original Win16 instructions', () => {
  for (const [index, { input, expected }] of ruleFixtures.missiles.entries()) {
    const state = { ...structuredClone(input), score: 0, events: [] };
    const stop = collideMissile(state, input);
    assert.deepEqual({ cells: state.cells, stop, sy: state.ball.sy, score: state.score },
      expected, `missile ${index}`);
  }
});
test('BeeBop II: brick collisions match original Win16 instructions', () => {
  for (const [index, { input, expected }] of fixtures.cases.entries()) {
    const cells = Array(247).fill(48);
    for (const [i, kind] of input.cells) cells[i] = kind;
    const ball = { ...input.ball };
    const state = { cells, multiballActive: input.multiballActive,
      lives: 6, score: 0, weapon: 0, missiles: [] };
    collideCells(state, ball);
    assert.deepEqual({ cells: sparse(cells),
      ball: { x: ball.x, y: ball.y, sx: ball.sx, sy: ball.sy, pattern: ball.pattern },
      lives: state.lives, weapon: state.weapon, score: state.score }, expected, `case ${index}`);
  }
});
test('BeeBop II: paddle impacts match original Win16 instructions', () => {
  for (const [index, { input, expected }] of fixtures.paddleCases.entries()) {
    const state = { paddle: { x: 300, y: 400, width: input.width,
      thresholds: input.thresholds }, events: [] };
    const ball = { x: input.x, y: input.y, sx: 1, sy: -1, pattern: 3 };
    collidePaddle(state, ball);
    assert.deepEqual([ball.sx, ball.sy, ball.pattern], expected, `case ${index}: ${JSON.stringify(input)}`);
  }
});
