// BeeBop II, 1008:351f. Coordinates are the original ball centre, not its top-left.
// The signed direction multiplies the (negative) three-step movement pattern.
export const PATTERNS = [
  [[0, -1], [0, -1], [0, -1]],
  [[0, -1], [-1, -1], [0, -1]],
  [[-1, -1], [0, -1], [-1, -1]],
  [[-1, -1], [-1, -1], [-1, -1]],
  [[-1, -1], [-1, 0], [-1, -1]],
  [[-1, 0], [-1, -1], [-1, 0]],
];

const soft = kind => [49, 77, 83, 215, 136].includes(kind);
const hard = kind => [65, 66, 67].includes(kind);
const column = x => Math.max(1, Math.min(19, Math.ceil(x / 30)));
const row = y => Math.max(1, Math.min(13, Math.ceil(y / 30)));

export function collisionCorners(ball) {
  const left = column(ball.x - 45);
  const right = column(ball.x - 26);
  const top = row(ball.y - 60);
  const bottom = row(ball.y - 42);
  return [(top - 1) * 19 + left - 1, (bottom - 1) * 19 + left - 1,
    (bottom - 1) * 19 + right - 1, (top - 1) * 19 + right - 1];
}

export function collideCells(state, ball) {
  const indices = collisionCorners(ball);
  const kinds = indices.map(i => state.cells[i]);
  // The bottom-right double-laser probe really reads bottom-left in the binary.
  const touchesSoft = kinds.map((kind, corner) => corner === 2
    ? [49, 77, 83, 136].includes(kind) || kinds[1] === 215 : soft(kind));
  const occupied = kinds.map((kind, i) => Number(touchesSoft[i]) + Number(kind === 50) + Number(hard(kind)));
  const count = occupied.reduce((sum, value) => sum + value, 0);
  const hitSoft = touchesSoft.some(Boolean);
  const hitHard = kinds.some(hard);
  const events = [];
  if (hitSoft || hitHard) state.idleTicks = 0;
  if (ball.primary !== false || state.multiballActive) {
    const index = indices.find(i => soft(state.cells[i]));
    if (index !== undefined) {
      const kind = state.cells[index];
      if (kind === 136) state.lives += 1;
      if (kind === 77 || kind === 215) {
        state.weaponFlashStatus = state.weapon ? !state.weaponFlashStatus : true;
        state.weapon = kind === 77 ? 1 : 2;
        state.weaponTicks = 0;
      }
      if (kind === 83) {
        state.weapon = 0;
        state.missiles.length = 0;
        state.weaponFlashLabel = state.weaponFlashStatus = false;
      }
      state.cells[index] = 48;
      events.push({ type: 'brick', index, kind });
    }
    // Four independent passes, in this order: ordinary, C, B, A. A contact can
    // therefore damage different tiers simultaneously, but never twice per tier.
    for (const kind of [67, 66, 65]) {
      const index = indices.find(i => state.cells[i] === kind);
      if (index !== undefined) {
        state.cells[index] = kind === 67 ? 49 : kind + 1;
        events.push({ type: 'damage', index, kind });
      }
    }
  }
  // Native secondary-ball contacts still run the score/sound path even while
  // the second ball is not yet permitted to erase cells (121c / 1222).
  if (hitSoft || events.some(event => event.type === 'brick')) {
    state.score += 10;
    state.idleTicks = 0;
  }
  if (hitHard) events.push({ type: 'hard' });
  else if (kinds.includes(50)) events.push({ type: 'wall' });
  if ([1, 2, 3].includes(count)) {
    ball.x = ball.previousX;
    ball.y = ball.previousY;
  }
  if (count === 2) {
    if ((occupied[0] && occupied[1]) || (occupied[3] && occupied[2])) ball.sx *= -1;
    else ball.sy *= -1;
  } else if (count === 3) {
    ball.sx *= -1;
    ball.sy *= -1;
  } else if (count === 1) {
    if (hitSoft && ball.pattern === 0) ball.pattern = state.verticalPaddle ? 5 : 1;
    const corner = occupied.findIndex(Boolean);
    if (!hitSoft) {
      ball.sx = corner === 0 || corner === 1 ? -1 : 1;
      ball.sy = corner === 0 || corner === 3 ? -1 : 1;
    } else if (corner === 0) {
      if (ball.sx < 1 || ball.sy < 1) ball.sx = -1;
      ball.sy = -1;
    } else if (corner === 3) {
      if (!(ball.sx < 0 && ball.sy > 0)) ball.sx = 1;
      ball.sy = -1;
    } else if (corner === 1) {
      if (ball.sx < 1 || ball.sy > -1) ball.sx = -1;
      ball.sy = 1;
    } else {
      if (!(ball.sx < 0 && ball.sy < 0)) ball.sx = 1;
      ball.sy = 1;
    }
  }
  ball.sx |= 0;
  ball.sy |= 0;
  return events;
}
