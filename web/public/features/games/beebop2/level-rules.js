import { runLevelTransitions } from './generated/level-transitions.js';

function key(address) { return address.toString(16).padStart(4, '0'); }

// 1008:0289 / 0178: each stage opens one to four rectangles, in reverse order.
export function openGate(state) {
  const r = state.rules;
  r['15a2'] = 1;
  if (r['14e2']) {
    r['15ae'] = r[key(0x14e2 + r['14e2'] * 4 - 2)];
    r['15ac'] = r[key(0x14e2 + r['14e2'] * 4)];
    r['14e2'] -= 1;
  }
  r['14e0'] += 1;
  const gate = r['14e0'];
  const countKey = key(0x14f2 + gate * 2);
  while (r[countKey] > 0) {
    const base = 0x14fc + (r[countKey] - 1) * 40 + gate * 2;
    const left = r[key(base)], top = r[key(base + 10)];
    const right = r[key(base + 20)], bottom = r[key(base + 30)];
    for (let y = top; y < bottom; y += 30) {
      for (let x = left; x < right; x += 30) {
        const col = Math.ceil((x - 15) / 30) - 1;
        const row = Math.ceil((y - 22) / 30) - 1;
        const index = row * 19 + col;
        if (index >= 0 && index < 247) {
          state.cells[index] = 48;
          state.targetCells[index] = 48;
        }
      }
    }
    r[countKey] -= 1;
  }
  state.events.push({ type: 'gate', gate });
}

export function updateLevel(state) {
  // 1000:3043 precedes 1008:0472 in the original outer loop.
  if (state.cells.every((kind, i) => kind === state.targetCells[i])) {
    state.phase = 'won';
    state.bonus = state.lives * 100;
    state.events.push({ type: 'won' });
    return;
  }
  runLevelTransitions(state, openGate);
  const r = state.rules;
  state.paddle.y = r['1008'];
  state.paddle.x = Math.max(r['100a'], Math.min(r['100c'], state.paddle.x));
}

// 1008:1ba5. Death lines are not the outer limits of the canvas: several boards
// have elevated floors, upper death lines, or a vertical exit on the right.
export function isBallLost(state, ball) {
  const r = state.rules;
  if ((r['0d18'] || r['0d12']) && !r['0d12']) return ball.x > r['1004'] + 2;
  if (r['0d12'] && ball.x > r['1004'] && ball.x < r['1004'] + 5 &&
      ball.y < r['0ffe'] - 9 && ball.y > r['1002'] + 3) return true;
  if (r['0d16']) return ball.y < r['1016'] + 10 || ball.y > r['103a'] + 5;
  return ball.y > r['1016'] + 5;
}
