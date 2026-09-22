// Win16 presentation rules, independent of Canvas, the DOM and wall-clock time.
export const MENU_WIDTH = 551;
export const MENU_HEIGHT = 363;
export const DEFAULT_SPEED = 36;
export const REFERENCE_TICK_MS = 1000 / 94; // 1008:ae95
export const FINALE_DURATION = (74 + 148 + 100) * 5; // 1008:8bd5

export { calibrateTiming, frameInterval } from '../beebop-common/timing.js';

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

export { readScores, qualifies, insertScore } from '../beebop-common/scores.js';
