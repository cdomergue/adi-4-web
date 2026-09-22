// PLACEBFR.EXE: board conversion 1030:1a3f; motion/collisions 1028:060f..12d1.
export const WIDTH = 640, HEIGHT = 440, COLS = 26, ROWS = 16, TILE = 24, TICK_MS = 25;
export const SAVE_KEY = 'adi4-placeball-v1';
export const CELL_CODES = [0, 700, 400, 401, 402, 403, 100, 200, 201,
  600, 601, 602, 603, 604, 300, 500, 501, 502, 0, 0];
export const SPEEDS = [0, 2, 4, 6, 12, 24];
const dx = [0, 0, 1, 0, -1], dy = [0, -1, 0, 1, 0];
export const family = cell => Math.floor(cell / 100);
export const index = (x, y) => x * ROWS + y;

export function createGame(campaign, levelIndex = 0, { score = 0, difficulty = 0, speed = 3 } = {}) {
  const level = campaign.levels[levelIndex];
  if (!level) throw new RangeError('Niveau inconnu');
  const raw = level.columns.flatMap(column => column.match(/../g).map(Number));
  const board = raw.map(code => CELL_CODES[code]);
  if (board.length !== COLS * ROWS || board.some(cell => cell === undefined))
    throw new Error('Tableau invalide');
  const state = { levelIndex, difficulty: difficulty === 1 ? 1 : 0,
    speed: SPEEDS[speed] ? speed : 3, pendingSpeed: null,
    board, score: Number.isSafeInteger(score) && score >= 0 ? score >>> 0 : 0,
    lives: board.filter(cell => cell === 700).length,
    holes: board.filter(cell => family(cell) === 1).length,
    prizes: board.filter(cell => family(cell) === 5).length,
    ball: null, selected: 0, launchers: [], phase: 'ready', elapsed: 0,
    phaseTime: 0, events: [], seed: 1 };
  state.startScore = state.score;
  state.board = board.map(cell => cell === 700 ? 0 : cell);
  // Clockwise perimeter order from 1028:1c75, not simple row-major order.
  for (const direction of [2, 3, 0, 1]) {
    const positions = board.map((cell, i) => ({ cell, i, x: Math.floor(i / ROWS), y: i % ROWS }))
      .filter(p => p.cell === 400 + direction);
    positions.sort((a, b) => direction === 2 ? a.x - b.x || a.y - b.y
      : direction === 3 ? a.y - b.y || b.x - a.x
      : direction === 0 ? b.x - a.x || b.y - a.y : b.y - a.y || a.x - b.x);
    state.launchers.push(...positions.map(p => p.i));
  }
  return state;
}

export function selectLauncher(state, delta) {
  if (state.phase !== 'ready' || !state.launchers.length) return;
  state.selected = (state.selected + delta + state.launchers.length) % state.launchers.length;
}

export function launch(state, cell = state.launchers[state.selected]) {
  if (state.phase !== 'ready' || state.lives < 1 || !state.launchers.includes(cell)) return false;
  state.ball = { x: Math.floor(cell / ROWS) * TILE, y: cell % ROWS * TILE,
    direction: state.board[cell] % 100 + 1 };
  state.lives--;
  state.phase = 'moving';
  return true;
}

export function reflect(direction, variant = 0) {
  const reverse = (direction + 1) % 4 + 1;
  return ([{}, { 4: 3, 1: 2 }, { 2: 3, 1: 4 }, { 4: 1, 3: 2 }, { 2: 1, 3: 4 }]
    [variant] || {})[direction] || reverse;
}

function addScore(state, points, event) {
  state.score = (state.score + points * (state.difficulty + 1)) >>> 0;
  state.events.push(event);
}

function finishBall(state) {
  state.ball = null;
  state.phase = state.lives ? 'ready' : 'gameover';
  if (!state.lives) state.score = state.startScore;
}

// One fixed native timer iteration. Speed changes only at cell boundaries.
export function step(state) {
  state.events = [];
  state.elapsed += TICK_MS;
  if (state.phase === 'dying') {
    state.phaseTime += TICK_MS;
    if (state.phaseTime >= 1400) finishBall(state);
    return;
  }
  if (state.phase === 'won') { state.phaseTime += TICK_MS; return; }
  if (state.phase !== 'moving') return;
  const ball = state.ball;
  if (ball.x % TILE === 0 && ball.y % TILE === 0 && state.pendingSpeed !== null) {
    state.speed = state.pendingSpeed;
    state.pendingSpeed = null;
  }
  ball.x += dx[ball.direction] * SPEEDS[state.speed];
  ball.y += dy[ball.direction] * SPEEDS[state.speed];
  if (ball.x % TILE || ball.y % TILE) return;
  const x = ball.x / TILE, y = ball.y / TILE;
  const i = index(x, y), cell = state.board[i], kind = family(cell);
  // Original levels enclose the trajectory; guard malformed/imported boards.
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) {
    state.phase = 'dying'; state.phaseTime = 0; state.events.push('death'); return;
  }
  if (kind === 1) {
    state.board[i] = 0; state.holes--; addScore(state, 250, 'hole');
  } else if (kind === 6) {
    ball.direction = reflect(ball.direction, cell % 100); addScore(state, 5, 'wall');
  } else if (kind === 2) {
    ball.direction = (cell === 200 ? [0, 4, 3, 2, 1] : [0, 2, 1, 4, 3])[ball.direction];
    state.board[i] = cell === 200 ? 201 : 200; addScore(state, 10, 'flipper');
  } else if (kind === 5) {
    state.board[i] = 0; state.prizes--; addScore(state, 100, 'prize');
  }
  if (!state.holes && (!state.difficulty || !state.prizes)) {
    addScore(state, 1000, 'win'); state.phase = 'won'; state.phaseTime = 0;
    if (kind === 1) state.ball = null;
  } else if (kind === 1) finishBall(state);
  else if (kind === 3 || kind === 4) {
    if (kind === 3) state.board[i] = 0;
    state.phase = 'dying'; state.phaseTime = 0; state.seed++;
    state.events.push('death');
  }
}

export function checkpoint(state) {
  return { levelIndex: state.levelIndex, score: state.startScore, difficulty: state.difficulty,
    speed: state.pendingSpeed ?? state.speed };
}

export function readCheckpoint(value, campaign) {
  if (!value || !Number.isInteger(value.levelIndex) || !campaign.levels[value.levelIndex] ||
      !Number.isInteger(value.score) || value.score < 0 || value.score > 0xffffffff ||
      ![0, 1].includes(value.difficulty) || !Number.isInteger(value.speed) || !SPEEDS[value.speed])
    return null;
  return { levelIndex: value.levelIndex, score: value.score, difficulty: value.difficulty, speed: value.speed };
}
