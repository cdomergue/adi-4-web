// 1020:1143. Missiles can damage several different armour grades in one pass,
// but neither collect nor destroy bonus bricks. Their collision probe is ahead
// of the image, and the original ball check intentionally has no lower bound.
export function collideMissile(state, missile) {
  const row = Math.max(1, Math.min(13, Math.ceil((missile.y - 53) / 30)));
  const columns = [missile.x - 34, missile.x - 28].map(x =>
    Math.max(1, Math.min(19, Math.ceil(x / 30))));
  const indices = columns.map(col => (row - 1) * 19 + col - 1);
  let stop = indices.some(i => state.cells[i] !== 48);
  if (stop) {
    for (const [kind, next] of [[49, 48], [67, 49], [66, 67], [65, 66]]) {
      const index = indices.find(i => state.cells[i] === kind);
      if (index === undefined) continue;
      state.cells[index] = next;
      if (kind === 49) state.score += 10;
      state.events.push({ type: kind === 49 ? 'brick' : 'damage', index, kind });
    }
  }
  const ball = state.ball;
  if (ball.x - 10 < missile.x + 5 && missile.x < ball.x + 10 && missile.y < ball.y + 30) {
    stop = true;
    if (ball.sy < 0) {
      ball.sy = -ball.sy;
      state.idleTicks = 0;
    }
    state.events.push({ type: 'missile-ball' });
  }
  return stop;
}

// 1020:169f: holding the button fires when the preceding salvo has disappeared.
export function stepMissiles(state, fire) {
  if (!state.weapon) return;
  if (!state.missiles.length) {
    if (!fire) return;
    const { x, y, width } = state.paddle;
    const shots = (state.weapon === 1 ? [x + Math.trunc(width / 2) - 3] :
      [x + 2, x + width - 7]).map(x => ({ x, y: y - 21, stopped: false }));
    const b = state.ball;
    if (shots.every(m => m.x + 5 <= b.x - 10 || b.x + 10 <= m.x || b.y + 30 <= m.y)) {
      state.missiles = shots;
      state.events.push({ type: 'fire' });
    }
    return;
  }
  for (const missile of state.missiles) {
    if (missile.stopped) continue;
    missile.y -= 15;
    if (collideMissile(state, missile)) {
      missile.stopped = true;
      missile.x = missile.y = 600;
    }
  }
  if (state.missiles.every(m => m.stopped) ||
      state.missiles.some(m => m.y - 15 < 49 + state.rules['0d14'])) state.missiles = [];
}
