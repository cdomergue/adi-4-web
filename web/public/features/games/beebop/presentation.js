// Win16 presentation rules, independent of Canvas, the DOM and wall-clock time.
export const MENU_WIDTH = 551;
export const MENU_HEIGHT = 363;
export const DEFAULT_SPEED = 36;
export const REFERENCE_TICK_MS = 1000 / 94; // 1008:ae95
export const FINALE_DURATION = (74 + 148 + 100) * 5; // 1008:8bd5

// 1008:afbc..afde, b78e..b975: +/-2 changes the calibrated waiting time by
// base/3 below 36, base/10 above it. The actual computation time is not removed.
// A browser rendering benchmark supplies that machine-dependent part.
export function calibrateTiming(baselineFps, busyLoopsPerSecond) {
  const frameCostMs = 1000 / baselineFps;
  const realWait = Math.max(0, (baselineFps / 94 - 1) * (busyLoopsPerSecond / baselineFps));
  const wait = Math.trunc(realWait) + (Math.trunc((realWait % 1) * 10) > 5 ? 1 : 0);
  const slowStep = Math.trunc(wait / 3);
  // afcd..b067 divides the already-truncated quotient by 10 again before
  // examining its fractional digit. This is not Math.round(wait / 10).
  const quotient = Math.trunc(wait / 10);
  const fastStep = quotient + (quotient % 10 > 5 ? 1 : 0);
  const maxSpeed = fastStep ? Math.min(80, 36 + 2 * Math.floor(wait / fastStep)) : 80;
  return { wait, slowStep, fastStep, maxSpeed, frameCostMs, busyLoopsPerSecond };
}

export function frameInterval(speed, timing) {
  const value = Math.max(0, Math.min(timing.maxSpeed, Math.round(speed / 2) * 2));
  const wait = value <= 36 ? timing.wait + (36 - value) / 2 * timing.slowStep
    : timing.wait - (value - 36) / 2 * timing.fastStep;
  return timing.frameCostMs + wait * 1000 / timing.busyLoopsPerSecond;
}

export function createMenuBall() { return { x: 440, y: 100, dx: 2, dy: 2 }; }

// 1008:acf7 / ac95: move first, then test strict bounds, without clamping.
export function stepMenuBall(ball) {
  ball.x += ball.dx;
  ball.y += ball.dy;
  if (ball.x < 379 || ball.x > 463) ball.dx = -ball.dx;
  if (ball.y < 43 || ball.y > 139) ball.dy = -ball.dy;
}

export function soundWait(manifest, name, enabled) {
  return enabled ? manifest.sounds[name].duration * 1000 : 500; // 1010:18ab
}

export function createBonus(lives, manifest, sound) {
  const revealLives = soundWait(manifest, 'AFFBON', sound);
  const revealBonus = revealLives + soundWait(manifest, 'KEY', sound);
  const countStart = revealBonus + soundWait(manifest, 'KEY', sound);
  const countEnd = countStart + lives * 100;
  return { type: 'win', elapsed: 0, revealLives, revealBonus, countStart, countEnd,
    duration: countEnd + soundWait(manifest, 'FINBON', sound) };
}

export function bonusRemaining(presentation, lives) {
  if (presentation?.type !== 'win') return 0;
  return Math.max(0, lives * 10 - Math.max(0,
    Math.floor((presentation.elapsed - presentation.countStart) / 10)));
}

// Synchronous SndPlaySound calls are asynchronous in the browser, but the
// presentation clock follows their playback position, including buffering.
export function synchronousCue(presentation) {
  if (presentation.type === 'gameover') return { name: 'ORGUE', start: 0, end: presentation.duration };
  if (presentation.type !== 'win') return null;
  const p = presentation;
  if (p.elapsed < p.revealLives) return { name: 'AFFBON', start: 0, end: p.revealLives };
  if (p.elapsed < p.revealBonus) return { name: 'KEY', start: p.revealLives, end: p.revealBonus };
  if (p.elapsed < p.countStart) return { name: 'KEY', start: p.revealBonus, end: p.countStart };
  if (p.elapsed >= p.countEnd) return { name: 'FINBON', start: p.countEnd, end: p.duration };
  return null;
}

export function readScores(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(row => row && typeof row.name === 'string' &&
    Number.isInteger(row.score) && row.score > 0 && row.score < 100000)
    .map(row => ({ name: row.name.slice(0, 17), score: row.score }))
    .sort((a, b) => b.score - a.score).slice(0, 10);
}

// 1010:17ab and 02c0: strictly higher than the tenth score; ties remain behind
// existing entries. Position 18 of the 21-byte record is overwritten by score.
export function qualifies(scores, score) {
  return score > (scores[9]?.score ?? 0);
}

export function insertScore(scores, name, score) {
  if (!qualifies(scores, score)) return scores;
  return readScores([...scores, { name, score }]);
}
