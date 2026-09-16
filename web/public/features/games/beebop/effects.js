// Beebop I, original segmented executable addresses (not Beebop II rules).
// Cell indices are zero-based; coordinates are the original top-left pixels.
// The caller owns life loss, level transitions, tick and idleTicks increments.

function sound(state, name) {
  state.events.push({ type: 'sound', sound: name });
}

function enemyEnabled(state) {
  // Explicit native 48ee flag; direction alone never enables the enemy.
  return Boolean(state.enemy && state.enemyEnabled);
}

function destroyBrick(state, index, kind, extraLife = false) {
  state.cells[index] = '0';
  state.idleTicks = 0;
  state.score += 1;
  state.events.push({ type: 'brick', index, kind });
  // 1008:1645 / 1000:2953: life bricks do not advance the bip/bop alternation.
  if (extraLife) {
    state.lives += 1;
    // 1008:1645 uses 49ec, loaded from 1028:0153 ("key").
    sound(state, 'key');
  } else {
    sound(state, state.brickSoundPhase === 1 ? 'bop' : 'bip');
    state.brickSoundPhase = state.brickSoundPhase === 1 ? 0 : 1;
  }
}

/** Ball contact only. kind is the cell character before mutation. */
export function hitBrick(state, index, kind) {
  if (index < 0 || index >= state.cells.length || state.cells[index] !== kind) return;
  // 1008:1109, 12e1, 1491, 1645; 1000:25b0.
  if (kind === '1' || kind === '7' || kind === 'b') {
    if (kind === '7') state.laser = true;
    destroyBrick(state, index, kind, kind === 'b');
  } else if (kind === 'Z' || kind === 'Y') {
    state.cells[index] = kind === 'Z' ? 'Y' : '1';
    state.idleTicks = 0;
    state.events.push({ type: 'brick', index, kind });
  }
}

// 1000:07a7 / 085f use inclusive upper bounds, unlike floor(pixel / 30).
function cellCoordinate(pixel, count) {
  return Math.max(0, Math.min(count - 1, Math.ceil(pixel / 30) - 1));
}

function missileCells(state, missile) {
  const row = cellCoordinate(missile.y - state.bounds.top - 15 + 1, 10);
  return [
    row * 16 + cellCoordinate(missile.x - state.bounds.left, 16),
    row * 16 + cellCoordinate(missile.x - state.bounds.left + 6, 16),
  ];
}

function hitMissileBricks(state, missile) {
  // 1000:120b samples both leading corners, 15px ahead of the updated missile.
  // It retains the last Z/Y classification; a 7 permits two destructions.
  const indices = missileCells(state, missile);
  let blocked = false;
  let damage = null;
  for (const index of indices) {
    const kind = state.cells[index];
    if (['5', 'Z', 'Y', '1', '2', 'b', '7'].includes(kind)) blocked = true;
    if (kind === 'Z' || kind === 'Y') damage = kind;
  }
  const hasLaserBrick = indices.some(index => state.cells[index] === '7');
  const originalKinds = indices.map(index => state.cells[index]);
  if (hasLaserBrick) {
    for (const index of indices) {
      if (state.cells[index] === '7') state.cells[index] = '1';
    }
  }
  for (let corner = 0; corner < indices.length; corner += 1) {
    const index = indices[corner];
    if (state.cells[index] === '1') {
      destroyBrick(state, index, originalKinds[corner]);
      if (!hasLaserBrick) break;
    }
  }
  if (damage) {
    const index = indices.find(index => state.cells[index] === damage);
    if (index !== undefined) hitBrick(state, index, damage);
  }
  // Life brick b and enemy 6 are never destroyed by a missile.
  return blocked;
}

function enemyTouchesBall(state) {
  // 1000:19b7 tests four points strictly inside the enemy, not rectangle overlap.
  const { enemy, ball } = state;
  if (!enemyEnabled(state)) return false;
  return [ball.x - 4, ball.x + 19].some(x =>
    [ball.y - 4, ball.y + 19].some(y =>
      enemy.x < x && x < enemy.x + 30 && enemy.y < y && y < enemy.y + 30,
    ),
  );
}

function moveEnemy(state) {
  // 1008:8818 and 86bb. The latter's floating operands are recovered from
  // 1008:86c5..8743: trunc((x-left-5)/30), trunc((y-top+15)/30),
  // trunc((x-left+35)/30), then +1 in the original one-based grid.
  const { enemy, bounds, cells } = state;
  if (!enemyEnabled(state)) return;
  enemy.x += enemy.dx;
  const col1 = Math.max(0, Math.min(15, Math.trunc((enemy.x - bounds.left - 5) / 30)));
  const col2 = Math.max(0, Math.min(15, Math.trunc((enemy.x - bounds.left + 35) / 30)));
  const row = Math.max(0, Math.min(9, Math.trunc((enemy.y - bounds.top + 15) / 30)));
  if ([cells[row * 16 + col1], cells[row * 16 + col2]].some(c => '1234'.includes(c))) {
    enemy.dx = -enemy.dx;
  }
  if (enemy.x > bounds.right - 36) enemy.dx = -1;
  if (enemy.x < bounds.left + 2) enemy.dx = 1;
}

function tickMissile(state, fire) {
  if (!state.laser) return;
  const { paddle, ball, enemy } = state;
  if (!state.missile) {
    if (fire) {
      // 1000:183d: width is the complete paddle width, not its active insets.
      state.missile = { x: paddle.x + Math.trunc(paddle.width / 2) - 2, y: paddle.y - 15 };
      sound(state, 'missil');
    }
    return; // The firing tick does not advance the missile.
  }
  const missile = state.missile;
  missile.y -= 15;
  // 1000:120b: an enemy absorbs the shot without dying or awarding points.
  let stopped = enemyEnabled(state) && enemy.y < missile.y - 15 && missile.y - 15 < enemy.y + 30 &&
    enemy.x < missile.x + 7 && missile.x - 3 < enemy.x + 30;
  if (hitMissileBricks(state, missile)) {
    state.missile = null;
    return; // Native sets y=1600 before the subsequent ball test.
  }
  // 1000:0758 intentionally has no lower vertical bound. Ascending balls also
  // absorb the shot, but only descending balls reverse and reset idleTicks.
  if (ball.x < missile.x + 5 && missile.x < ball.x + 15 && missile.y < ball.y + 30) {
    stopped = true;
    if (ball.dy > 0) {
      ball.dy = -ball.dy;
      state.idleTicks = 0;
    }
  }
  if (stopped || missile.y - 15 < state.bounds.top) state.missile = null;
}

/** Called after ball/paddle collisions, before the caller consumes state.lost. */
export function tickEffects(state, fire = false) {
  // 1008:8925's ready loop runs 8901 (movement), without 19b7 or 183d.
  if (state.phase === 'ready') {
    moveEnemy(state);
    return;
  }
  if (state.phase !== undefined && state.phase !== 'playing') return;
  // Main loop 1008:baed: enemy contact, missile, then enemy movement.
  if (enemyTouchesBall(state)) state.lost = true;
  tickMissile(state, fire);
  moveEnemy(state);
}

/** Called after idleTicks++, once per original simulation tick (1008:2355). */
export function tickIdle(state) {
  if (state.idleTicks !== 1000) return;
  const { ball } = state;
  if (ball.dx === -2 || ball.dx === -1) {
    if (ball.dy === 1 || ball.dy === -1) ball.dy *= 2;
    ball.dx = ball.dx === -2 ? -1 : 1;
  } else if (ball.dx === 1) {
    ball.dx = 2;
  } else if (ball.dx === 2 || ball.dx === 0) {
    ball.dx = -2;
  }
  state.idleTicks = 0;
}
