// 1010:219d. The original swaps x/y while evaluating the horizontal paddle.
// Off-centre impacts select a three-substep pattern, not a trigonometric angle.
export function collidePaddle(state, ball) {
  const { x, y, width } = state.paddle;
  const thresholds = state.paddle.thresholds;
  let hit = false;
  function face(sy) {
    ball.sx = -1;
    ball.sy = sy;
    const distance = ball.x - (x - 9);
    const patterns = [4, 3, 2, 1, 0, 1, 2, 3, 4];
    let section = thresholds.findIndex(value => distance > value);
    if (section === -1) section = 8;
    if (section >= 4) ball.sx = 1;
    ball.pattern = patterns[section];
    if (section === 4) ball.sx = 0;
    hit = true;
  }
  if (ball.x < x + 9 + width && x - 10 < ball.x) {
    if (y - 14 < ball.y && ball.y < y - 9) face(1);
    if (y + 17 < ball.y && ball.y < y + 22) face(-1);
  }
  if (y - 14 < ball.y && ball.y < y + 22) {
    if (x + 8 + width < ball.x && ball.x < x + 13 + width) {
      ball.sx = -1;
      ball.sy = ball.y < y + 5 ? 1 : -1;
      ball.pattern = 5;
      hit = true;
    }
    if (x - 14 < ball.x && ball.x < x - 8) {
      ball.sx = 1;
      ball.sy = ball.y < y + 5 ? 1 : -1;
      ball.pattern = 5;
      hit = true;
    }
  }
  if (hit) {
    state.idleTicks = 0;
    state.events.push({ type: 'paddle' });
  }
  return hit;
}
