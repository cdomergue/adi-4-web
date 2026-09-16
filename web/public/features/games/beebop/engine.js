import { hitBrick, tickEffects } from './effects.js';
import { createLevelFlags, updateLevelRules, updatePaddleHeight } from './level-rules.js';

// BEEBOP1.EXE: 1008:1645 (collisions), 0fa8 (paddle), 8925 (serve),
// 1000:26ba (bounds). Coordinates and integer increments are the original ones.
export const SAVE_KEY = 'adi4-beebop1-v1';
export const WIDTH = 510;
export const HEIGHT = 360;
export const TICK_MS = 1000 / 94;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const normalizeCell = (c) => /[134]/.test(c) ? '1'
  : /[A-O]/.test(c) ? '2' : /[P-W]/.test(c) ? 'Z' : c;

export function createGame(campaign, levelIndex = 0, progress = {}) {
  if (campaign.episode !== 1) throw new Error('Unsupported BeeBop ruleset');
  const level = campaign.levels[levelIndex];
  if (!level || typeof level.cells !== 'string' || level.cells.length !== 160)
    throw new Error('Invalid BeeBop level');
  const cells = [...level.cells].map(normalizeCell);
  const left = 15 + (level.narrowing || 0) * 30;
  const right = 495 - (level.narrowing || 0) * 30;
  const enemyIndex = cells.lastIndexOf('6');
  const state = {
    episode: campaign.episode || 1, levelIndex, levelId: level.internalId, level,
    cells, artCells: [...level.cells],
    targetCells: cells.map((c) => '1Z7bY'.includes(c) ? '0' : c),
    bounds: { left, right, top: 11, bottom: 306 },
    paddle: { x: left + (level.leftInset || 0), y: level.paddleY,
      width: level.width, leftInset: level.leftInset || 0, rightInset: level.rightInset || 0 },
    ball: { x: 0, y: 0, dx: 0, dy: -2 },
    enemy: enemyIndex < 0 ? null : { x: left + enemyIndex % 16 * 30,
      y: 11 + Math.floor(enemyIndex / 16) * 30, dx: level.enemyMoving ? 1 : 0 },
    enemyEnabled: Boolean(level.enemyMoving),
    laser: false, missile: null, score: progress.score || 0,
    lives: progress.lives ?? 8, tick: 0, idleTicks: 0, lost: false,
    phase: 'ready', events: [], flags: { ...createLevelFlags(), ...progress.flags, '4908': 0 }, explosions: [],
  };
  if (state.levelId === 24 || state.levelId === 25) state.flags['48fe'] = 0;
  movePaddle(state, (left + right - state.paddle.width) / 2);
  return state;
}

export function movePaddle(state, x) {
  if (!Number.isFinite(x)) return;
  const p = state.paddle;
  p.x = Math.round(clamp(x, state.bounds.left + p.leftInset,
    state.bounds.right - p.rightInset - p.width));
  if (p.previousX !== p.x) updatePaddleHeight(state);
  p.previousX = p.x;
  if (state.phase === 'ready') {
    state.ball.x = state.paddle.x + Math.trunc(state.paddle.width / 2) - 8;
    state.ball.y = state.paddle.y - 22;
  }
}

export function launch(state) {
  if (state.phase !== 'ready') return false;
  state.phase = 'playing';
  state.ball.dx = 0;
  state.ball.dy = -2;
  // 1008:8925: the opened gate in tableau 26 is erased again on each serve.
  if (state.levelId === 26 && state.flags['4902'] === 1) {
    for (const index of [17, 18, 19, 20, 21, 22, 23, 81, 82, 83, 84, 85, 86, 87,
      33, 49, 65, 39, 55, 71]) {
      state.cells[index] = '0'; state.targetCells[index] = '0';
    }
  }
  state.events.push({ type: 'launch' });
  return true;
}

// Pascal uses ceil-based, saturated one-based grid coordinates, including at edges.
export function cellIndex(state, x, y) {
  const col = clamp(Math.ceil((x - state.bounds.left) / 30), 1, 16) - 1;
  const row = clamp(Math.ceil((y - state.bounds.top) / 30), 1, 10) - 1;
  return row * 16 + col;
}

export function collideBricks(state, previous) {
  const b = state.ball;
  // Order: top-left, bottom-left, bottom-right, top-right. Duplicate corners
  // contribute to the bounce count, but a brick is destroyed only once.
  const indices = [cellIndex(state, b.x - 3, b.y - 3),
    cellIndex(state, b.x - 3, b.y + 18), cellIndex(state, b.x + 18, b.y + 18),
    cellIndex(state, b.x + 18, b.y - 3)];
  const kinds = indices.map((i) => state.cells[i]);
  const extraLife = kinds.includes('b');
  const laser = kinds.includes('7');
  const normal = (!extraLife && kinds.includes('1')) || laser;
  const hard = kinds.includes('Y') ? 'Y' : kinds.includes('Z') ? 'Z' : null;
  const wall = kinds.includes('2');
  const occupied = kinds.map((c) => c === 'b' || (!extraLife && c === '1')
    || 'ZY72'.includes(c));
  const count = occupied.filter(Boolean).length;
  const kind = extraLife ? 'b' : laser ? '7' : normal ? '1' : hard;
  if (laser) state.laser = true;
  // 1008:1e83/1ea0: simultaneous b+7 grants both points, but destroys only b.
  if (extraLife && laser) {
    state.score += 1;
    state.events.push({ type: 'sound', sound: state.brickSoundPhase === 1 ? 'bop' : 'bip' });
    state.brickSoundPhase = state.brickSoundPhase === 1 ? 0 : 1;
  }
  if (kind) hitBrick(state, indices[kinds.indexOf(kind)], kind);
  // Original checks the hard-brick pass separately from a life bonus.
  if (extraLife && hard && !normal) hitBrick(state, indices[kinds.indexOf(hard)], hard);
  if (wall) state.events.push({ type: 'wall' });
  if (count === 2) {
    if ((occupied[0] && occupied[1]) || (occupied[3] && occupied[2])) b.dx = -b.dx;
    else b.dy = -b.dy;
  } else if (count === 3) {
    b.dx = -b.dx;
    b.dy = -b.dy;
  } else if (count === 1) {
    const corner = occupied.indexOf(true);
    const sx = corner === 0 || corner === 1 ? 1 : -1;
    const sy = corner === 0 || corner === 3 ? 1 : -1;
    if (normal || extraLife) {
      if (b.dx * sx < 0 && b.dy * sy < 0) b.dy = -b.dy;
      else {
        if (b.dx * sx < 0) b.dx = -b.dx;
        if (b.dy * sy < 0) b.dy = -b.dy;
      }
    }
    if (wall || hard) {
      if (b.dx * sx < 0) b.dx = -b.dx;
      if (b.dy * sy < 0) b.dy = -b.dy;
    }
  }
  if (normal || wall || hard || extraLife) {
    b.x = previous.x + b.dx;
    b.y = previous.y + b.dy;
  }
  if (kinds.includes('5')) state.lost = true;
}

export function bouncePaddle(state) {
  const b = state.ball, p = state.paddle;
  const cut = [-p.width / 4, -p.width / 16, p.width / 8, 5 * p.width / 16,
    11 * p.width / 16, 7 * p.width / 8, 17 * p.width / 16, 5 * p.width / 4]
    .map(Math.trunc);
  if (b.y <= p.y - 20 || b.x + 8 <= p.x + cut[0] || b.x >= p.x + cut[7]) return;
  const velocity = [[-2, -1], [-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2], [2, -1]];
  const zone = cut.slice(1).findIndex((x) => b.x + 8 < p.x + x);
  if (zone >= 0) [b.dx, b.dy] = velocity[zone];
  state.idleTicks = 0;
  state.events.push({ type: 'paddle' });
}

export function won(state) {
  return state.cells.every((cell, i) => cell === state.targetCells[i]);
}

// One original loop iteration. The view supplies elapsed time; the engine is
// deterministic and independent of requestAnimationFrame and the DOM.
export function step(state, { x, fire = false } = {}, patterns = {}) {
  state.events = [];
  if (state.phase !== 'playing' && state.phase !== 'ready') return state;
  state.tick++;
  state.explosions = (state.explosions || []).filter(e => state.tick - e.tick < 20);
  if (state.phase === 'ready') {
    if (x !== undefined || state.paddle.previousX === 10000) movePaddle(state, x ?? state.paddle.x);
    tickEffects(state, false);
    if (fire) launch(state);
    return state;
  }
  const b = state.ball, previous = { x: b.x, y: b.y }, bounds = state.bounds;
  b.x += b.dx;
  b.y += b.dy;
  if (b.x > bounds.right - 18 || b.x < bounds.left + 4) {
    b.dx = -b.dx; b.x = previous.x; b.y = previous.y;
    state.events.push({ type: 'wall' });
  }
  if (b.y < bounds.top + 4) {
    b.dy = -b.dy; b.x = previous.x; b.y = previous.y;
    state.events.push({ type: 'wall' });
  }
  if (b.y < bounds.top + 4 || b.y > bounds.bottom - 18) state.lost = true;
  collideBricks(state, previous);
  bouncePaddle(state);
  // Native 23e0 reads the pointer after collision against the previous paddle.
  if (x !== undefined || state.paddle.previousX === 10000) movePaddle(state, x ?? state.paddle.x);
  tickEffects(state, fire);
  for (const event of state.events) {
    if (event.type === 'brick' && state.cells[event.index] === '0') {
      state.explosions.push({ ...event, tick: state.tick, colour: state.sparklePhase || 0 });
      state.sparklePhase = ((state.sparklePhase || 0) + 1) % 3;
    }
  }
  if (state.lost) {
    state.lost = false;
    state.lives--;
    state.idleTicks = 0;
    state.missile = null;
    state.phase = state.lives < 0 ? 'gameover' : 'ready';
    movePaddle(state, state.paddle.x);
    state.events.push({ type: 'loss', x: previous.x, y: previous.y });
    return state;
  }
  state.idleTicks++;
  updateLevelRules(state, patterns);
  if (won(state)) {
    state.score += state.lives * 10;
    state.phase = 'won';
    state.events.push({ type: 'win' });
  }
  // 1008:2355: escape a trajectory with no contact for 1000 iterations.
  if (state.idleTicks === 1000) {
    if (b.dx === -2 || b.dx === -1) {
      if (Math.abs(b.dy) === 1) b.dy *= 2;
      b.dx = b.dx === -2 ? -1 : 1;
    } else b.dx = b.dx === 1 ? 2 : -2;
    state.idleTicks = 0;
  }
  return state;
}
