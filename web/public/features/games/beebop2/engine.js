import { PATTERNS, collideCells } from './collisions.js';
import { collidePaddle } from './paddle.js';
import { stepMissiles } from './missiles.js';
import { updateLevel, isBallLost } from './level-rules.js';

export const WIDTH = 640;
export const HEIGHT = 480;
export const TICK_MS = 1000 / 94;

export function createGame(campaign, levelIndex = 0, options = {}) {
  const path = options.path === 1 ? 1 : 0;
  levelIndex = Math.max(0, Math.min(19, Math.trunc(levelIndex) || 0));
  const stage = campaign.paths[path][levelIndex];
  const level = campaign.levels.find(l => l.id === stage);
  const rules = { ...level.config, '077a': 19, '077c': 3 };
  if (stage === 17) rules['0d12'] = 0; // 1000:2ade, after death-line initialization.
  const artCells = [...level.boards['19ec']];
  const state = {
    path, levelIndex, stage, level, rules, artCells,
    cells: artCells.map(c => campaign.cellTypes[c].kind),
    targetCells: artCells.map(c => campaign.cellTypes[c].target),
    phase: 'ready', lives: Number.isInteger(options.lives) ? Math.max(0, options.lives) : 6,
    score: Number.isInteger(options.score) ? Math.max(0, options.score) : 0,
    paddle: { x: rules['100a'], y: rules['1008'], width: 40,
      thresholds: [35, 31, 26, 22, 17, 13, 8, 4] },
    weapon: 0, missiles: [], events: [], tick: 0,
    weaponTicks: 0, weaponFlashLabel: false, weaponFlashStatus: false,
    idleTicks: 0, unstick: 0, substep: 0, multiballActive: false, verticalPaddle: false,
    ballStyle: [1, 1, 5, 3, 5, 3, 1, 1, 2, 2, 5, 1, 2, 2, 3, 4, 1, 2, 3, 1][levelIndex],
  };
  serve(state);
  return state;
}

function serve(state) {
  const x = state.paddle.x + Math.trunc(state.paddle.width / 2);
  const y = state.paddle.y - 13;
  state.ball = { x, y, previousX: x, previousY: y, sx: 0, sy: 1, pattern: 0, primary: true };
  state.idleTicks = 0;
  state.substep = 0;
}

export function movePaddle(state, x) {
  if (!Number.isFinite(x)) return;
  state.paddle.x = Math.max(state.rules['100a'], Math.min(state.rules['100c'], Math.trunc(x)));
  state.paddle.y = state.rules['1008'];
  if (state.phase === 'ready') serve(state);
}

export function launch(state) {
  if (state.phase !== 'ready') return false;
  state.phase = 'playing';
  state.events.push({ type: 'launch' });
  return true;
}

// One calibrated substep, not one browser animation frame. The native outer
// loop reads the pointer only after three substeps and checks gates at that point.
export function step(state, input = {}) {
  state.events = [];
  if (state.phase === 'ready') {
    movePaddle(state, input.x);
    if (input.fire) launch(state);
    return state;
  }
  if (state.phase !== 'playing') return state;
  const ball = state.ball;
  if (state.substep === 0) state.idleTicks += 1;
  ball.previousX = ball.x;
  ball.previousY = ball.y;
  const [dx, dy] = PATTERNS[ball.pattern][state.substep];
  ball.x += dx * ball.sx * 2;
  ball.y += dy * ball.sy * 2;
  if (ball.y > 434) ball.sy = 1;
  if (ball.y < 61) ball.sy = -1;
  if (ball.x > 598) ball.sx = 1;
  if (ball.x < 42) ball.sx = -1;
  collidePaddle(state, ball);
  state.events.push(...collideCells(state, ball));
  // 1010:2865: alternate inversion of the label and ON indicator.
  if (state.weapon) {
    state.weaponTicks += 1;
    if (state.weaponTicks === 15) state.weaponFlashLabel = !state.weaponFlashLabel;
    if (state.weaponTicks === 30) {
      state.weaponFlashStatus = !state.weaponFlashStatus;
      state.weaponTicks = 0;
    }
  }
  stepMissiles(state, input.fire);
  state.tick += 1;
  if (isBallLost(state, ball)) {
    state.events.push({ type: 'loss', x: ball.x, y: ball.y });
    if (state.lives === 0) state.phase = 'gameover';
    else {
      state.lives -= 1;
      state.phase = 'ready';
      serve(state);
    }
    return state;
  }
  state.substep = (state.substep + 1) % 3;
  if (state.substep === 0) {
    updateLevel(state);
    if (state.phase === 'won') {
      state.score += state.bonus;
      return state;
    }
    if (!state.rules['14dc'] && state.idleTicks > 300) {
      if (ball.pattern === 0) ball.sx = 1;
      state.unstick = state.unstick % 5 + 1;
      ball.pattern = [5, 4, 3, 2, 1][state.unstick - 1];
      state.idleTicks = 0;
    }
    movePaddle(state, input.x);
  }
  return state;
}
