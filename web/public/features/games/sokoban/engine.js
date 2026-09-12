// Native cell categories from SOKOBFR.EXE 1000:366c / 1000:38e9.
export function startLevel(level) {
  const cells = [...level.cells],
    player = cells.findIndex((v) => v < 100),
    direction = cells[player];
  cells[player] = 200;
  return {
    cells,
    player,
    direction,
    width: level.width,
    height: level.height,
    moves: 0,
    pushes: 0,
    remaining: level.boxes * 120,
  };
}
export const won = (state) => state.cells.every((v) => Math.floor(v / 100) !== 1);
export function move(state, dx, dy) {
  if (Math.abs(dx) + Math.abs(dy) !== 1 || won(state) || state.remaining <= 0) return state;
  const x = state.player % state.width,
    y = Math.floor(state.player / state.width),
    nx = x + dx,
    ny = y + dy;
  const inside = (a, b) => a >= 0 && b >= 0 && a < state.width && b < state.height;
  if (!inside(nx, ny)) return state;
  const target = ny * state.width + nx,
    kind = Math.floor(state.cells[target] / 100),
    cells = [...state.cells];
  let pushed = false;
  if (kind === 4 || kind === 5) {
    const bx = nx + dx,
      by = ny + dy;
    if (!inside(bx, by)) return state;
    const beyond = by * state.width + bx,
      bkind = Math.floor(cells[beyond] / 100);
    if (bkind !== 1 && bkind !== 2) return state;
    cells[beyond] = (bkind === 1 ? 500 : 400) + (cells[beyond] % 100);
    cells[target] = (kind === 5 ? 100 : 200) + (cells[target] % 100);
    pushed = true;
  } else if (kind !== 1 && kind !== 2) return state;
  return {
    ...state,
    cells,
    player: target,
    direction: dy < 0 ? 0 : dx > 0 ? 1 : dy > 0 ? 2 : 3,
    moves: state.moves + 1,
    pushes: state.pushes + Number(pushed),
    remaining: state.remaining - 1,
  };
}
export function tileAt(state, index, phase = 0) {
  if (index === state.player) return 17 + state.direction;
  const value = state.cells[index],
    kind = Math.floor(value / 100);
  if (kind === 1) return ((value % 100) + phase) % 3;
  if (kind === 3) return (value % 100) + 4;
  if (kind === 4 || kind === 5) return 16;
  return 3;
}
