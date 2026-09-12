// MRMATT1.EXE 1.5: TMap virtual methods at 0042eaa8, recovered with Ghidra.
// Physics is triggered by a move; there is no global gravity timer.
export const WIDTH = 31;
export const HEIGHT = 18;
export const TILE = Object.freeze({
  AIR: 0,
  EARTH: 1,
  WALL: 2,
  STONE: 3,
  FOOD: 4,
  CRATE1: 5,
  CRATE2: 6,
  CRATE3: 7,
  PLAYER: 9,
  DEAD: 10,
  OUTSIDE: 11,
});
const vectors = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
const heavy = (value) => value === 3 || (value >= 5 && value <= 7);
export function startLevel(level) {
  if (
    !Array.isArray(level.cells) ||
    level.cells.length !== WIDTH * HEIGHT ||
    level.cells.filter((v) => v === TILE.PLAYER).length !== 1 ||
    level.cells.some((v) => ![0, 1, 2, 3, 4, 7, 9].includes(v))
  )
    throw new Error('Invalid Mr. Matt level');
  return {
    cells: [...level.cells],
    player: level.cells.indexOf(TILE.PLAYER),
    moves: 0,
    remaining: level.cells.filter((v) => v === TILE.FOOD).length,
    dead: false,
    events: [],
  };
}
export const won = (state) => state.remaining === 0 && !state.dead;

// Saved routes are replayed through the rules instead of trusting stored boards.
export function replayMoves(level, route) {
  if (typeof route !== 'string' || route.length > 16384 || /[^UDLR]/.test(route))
    throw new Error('Invalid route');
  let state = startLevel(level);
  for (const direction of route) {
    const next = move(state, direction, { noStupidMoves: false });
    if (next === state) throw new Error('Impossible saved move');
    state = next;
  }
  return state;
}

export function move(state, direction, { noStupidMoves = false } = {}) {
  if (!vectors[direction] || state.dead || won(state)) return state;
  const cells = [...state.cells];
  const next = { ...state, cells, events: [] };
  const neighbor = (pos, dir) => {
    if (pos < 0) return -1;
    const [dx, dy] = vectors[dir],
      x = (pos % WIDTH) + dx,
      y = Math.floor(pos / WIDTH) + dy;
    return x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT ? -1 : y * WIDTH + x;
  };
  const at = (pos) => (pos < 0 ? TILE.OUTSIDE : cells[pos]);
  const sideFromPlayer = (pos) =>
    pos % WIDTH > next.player % WIDTH ? 'L' : pos % WIDTH < next.player % WIDTH ? 'R' : 'D'; // 0042eb00
  // 0042f440: every object relocation also checks for Matt directly beneath it.
  const relocate = (from, to) => {
    cells[to] = cells[from];
    cells[from] = TILE.AIR;
    if (at(neighbor(to, 'D')) === TILE.PLAYER) {
      cells[next.player] = TILE.DEAD;
      next.dead = true;
      next.events.push('kill');
    }
  };
  // 0042f5a4 / 0042ed4c: settle this object, then recurse up its vacated column.
  function fall(origin, preferred) {
    let pos = origin,
      falling = false;
    for (;;) {
      const below = neighbor(pos, 'D'),
        support = at(below);
      if (support === TILE.AIR) {
        relocate(pos, below);
        pos = below;
        falling = true;
        next.events.push('stone');
        continue;
      }
      if (support >= 5 && support <= 7) {
        cells[pos] = TILE.AIR;
        cells[below] = support === 5 ? TILE.AIR : support - 1;
        next.events.push('crate'); // 0042f528: impact consumes the falling object.
        break;
      }
      if (falling && support === TILE.STONE) {
        if (preferred === 'U' || preferred === 'D') preferred = sideFromPlayer(pos);
        const canRoll = (dir) => {
          const side = neighbor(pos, dir),
            under = at(neighbor(side, 'D'));
          return (
            at(side) === TILE.AIR &&
            (under === TILE.AIR || (under >= 5 && under <= 7) || under === TILE.PLAYER)
          );
        };
        const left = canRoll('L'),
          right = canRoll('R');
        if (left || right) {
          preferred = left && !(right && preferred === 'R') ? 'L' : 'R';
          const side = neighbor(pos, preferred);
          relocate(pos, side);
          pos = side;
          falling = false;
          continue;
        }
      }
      break;
    }
    if (pos !== origin) {
      const above = neighbor(origin, 'U');
      if (heavy(at(above))) fall(above, 'D');
    }
  }
  const old = state.player,
    target = neighbor(old, direction),
    kind = at(target);
  // 0042ec4c / 004352f0: optional protection when walking down below a heavy object.
  if (noStupidMoves && direction === 'D' && heavy(at(neighbor(old, 'U')))) return state;
  if (![TILE.AIR, TILE.EARTH, TILE.FOOD].includes(kind)) {
    if (
      !heavy(kind) ||
      (direction !== 'L' && direction !== 'R') ||
      at(neighbor(target, direction)) !== TILE.AIR
    )
      return state;
    const pushed = neighbor(target, direction);
    relocate(target, pushed);
    cells[old] = TILE.AIR;
    cells[target] = TILE.PLAYER;
    next.player = target;
    next.events.push('push');
    fall(pushed, direction);
  } else {
    cells[old] = TILE.AIR;
    cells[target] = TILE.PLAYER;
    next.player = target;
    if (kind === TILE.FOOD) {
      next.remaining--;
      next.events.push('pick');
    } else if (kind === TILE.EARTH) next.events.push('dig');
  }
  if (direction !== 'U') {
    const above = neighbor(old, 'U');
    if (heavy(at(above))) fall(above, direction === 'D' ? sideFromPlayer(target) : direction);
  }
  next.moves++;
  if (won(next)) next.events.push('win');
  return next;
}
