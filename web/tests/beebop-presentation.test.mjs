import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { frameInterval, calibrateTiming, REFERENCE_TICK_MS, createMenuBall, stepMenuBall,
  createBonus, bonusRemaining, readScores, qualifies, insertScore, FINALE_DURATION, synchronousCue
} from '../public/features/games/beebop/presentation.js';
import { drawEnding, drawMenu } from '../public/features/games/beebop/renderer.js';

const manifest = JSON.parse(readFileSync(new URL('../public/game/beebop1/artwork.json', import.meta.url)));

test('native speed calibration: 94 Hz, two-unit steps and two different slopes', () => {
  // Outputs from original 1008:ae13 arithmetic, with only timer/GDI sampling
  // skipped, under Unicorn. All software-float and division instructions run.
  for (const [fps, loops, wait, slowStep, fastStep] of [
    [1000, 100000, 964, 321, 97], [200, 60000, 338, 112, 33],
    [10000, 1000000, 10538, 3512, 1053],
  ]) {
    const timing = calibrateTiming(fps, loops);
    assert.equal(timing.wait, wait);
    assert.equal(timing.slowStep, slowStep);
    assert.equal(timing.fastStep, fastStep);
    assert.ok(Math.abs(frameInterval(36, timing) - REFERENCE_TICK_MS) < 1000 / loops);
    assert.ok(Math.abs(frameInterval(34, timing) - frameInterval(36, timing) - slowStep * 1000 / loops) < 1e-12);
    assert.ok(Math.abs(frameInterval(38, timing) - frameInterval(36, timing) + fastStep * 1000 / loops) < 1e-12);
    assert.ok(frameInterval(timing.maxSpeed, timing) >= timing.frameCostMs);
    assert.ok(frameInterval(0, timing) > frameInterval(2, timing));
  }
});

test('preview ball uses the original increment-then-strict-bounds loop', () => {
  const ball = createMenuBall();
  assert.deepEqual(ball, { x: 440, y: 100, dx: 2, dy: 2 });
  for (let i = 0; i < 12; i++) stepMenuBall(ball);
  assert.deepEqual(ball, { x: 464, y: 124, dx: -2, dy: 2 });
  for (let i = 0; i < 10000; i++) {
    stepMenuBall(ball);
    assert.ok(ball.x >= 378 && ball.x <= 464);
    assert.ok(ball.y >= 42 && ball.y <= 140);
  }
});

test('bonus waits for two confirmations then counts one point per 10 ms', () => {
  const bonus = createBonus(8, manifest, true);
  assert.equal(bonus.revealLives, manifest.sounds.AFFBON.duration * 1000);
  assert.equal(bonus.revealBonus - bonus.revealLives, manifest.sounds.KEY.duration * 1000);
  assert.equal(bonus.countEnd - bonus.countStart, 800);
  assert.equal(bonusRemaining(bonus, 8), 80);
  assert.equal(synchronousCue(bonus).name, 'AFFBON');
  bonus.elapsed = bonus.revealLives;
  assert.equal(synchronousCue(bonus).name, 'KEY');
  assert.equal(synchronousCue(bonus).start, bonus.revealLives);
  bonus.elapsed = bonus.revealBonus;
  assert.equal(synchronousCue(bonus).start, bonus.revealBonus);
  bonus.elapsed = bonus.countStart + 110;
  assert.equal(bonusRemaining(bonus, 8), 69);
  assert.equal(synchronousCue(bonus), null);
  bonus.elapsed = bonus.countEnd;
  assert.equal(bonusRemaining(bonus, 8), 0);
  assert.equal(synchronousCue(bonus).name, 'FINBON');
  const silent = createBonus(0, manifest, false);
  assert.equal(silent.duration, 2000);
  assert.equal(silent.countEnd, silent.countStart);
});

test('score table is bounded, stable on ties, strictly qualifying and treats names as data', () => {
  let scores = readScores([{ name: 'A', score: 20 }, { name: 'B', score: 10 },
    null, { name: '<img>', score: 0 }, { name: 'bad', score: Infinity }]);
  scores = insertScore(scores, 'C', 20);
  assert.deepEqual(scores.map(row => row.name), ['A', 'C', 'B']);
  scores = insertScore(scores, '<script>not html</script>', 30);
  assert.equal(scores[0].name, '<script>not html<');
  for (let i = 1; i <= 12; i++) scores = insertScore(scores, String(i), i);
  assert.equal(scores.length, 10);
  assert.equal(qualifies(scores, scores[9].score), false);
  assert.equal(qualifies([], 0), false);
  assert.equal(qualifies([], 1), true);
});

// A small recording context verifies native coordinates, resource selection and
// the finale phases without an HTML canvas or GPU in the Node test runner.
function recording() {
  const calls = [];
  const ctx = { canvas: { width: 510, height: 360 },
    save() {}, restore() {}, beginPath() {}, clip() {}, rect() {}, translate() {},
    createPattern: image => image.id,
    drawImage: (image, ...args) => calls.push(['image', image.id, ...args]),
    fillRect: (...args) => calls.push(['fill', ctx.fillStyle, ...args]),
    strokeRect: (...args) => calls.push(['stroke', ctx.strokeStyle, ...args]),
  };
  const artwork = { ball: { id: 'ball' },
    ...Object.fromEntries(['bitmaps', 'icons'].map(group => [group,
      Object.fromEntries(Object.entries(manifest[group]).map(([id, item]) =>
        [id, { id: Number(id), width: item.width, height: item.height }]))])) };
  return { ctx, calls, artwork };
}

test('menu resource placement matches 1008:0700/b1f3', () => {
  const { ctx, calls, artwork } = recording();
  drawMenu(ctx, artwork, createMenuBall(), 36, true);
  for (const call of [['image', 59, 54, 25], ['image', 60, 372, 35],
    ['image', 1050, 90, 165], ['image', 1011, 150, 322], ['image', 7, 53, 322],
    ['fill', '#f00', 500, 100, 8, 36]]) assert.ok(calls.some(c => JSON.stringify(c) === JSON.stringify(call)));
});

test('loss ending and final victory use different colors and FIN positions', () => {
  const state = { phase: 'won', level: { backgroundBitmap: 301 }, cells: Array(160).fill('0') };
  const { ctx, calls, artwork } = recording();
  drawEnding(ctx, state, artwork, { type: 'gameover', elapsed: 0 });
  assert.deepEqual(calls.at(-2), ['fill', '#ff9900', 14, 10, 481, 301]);
  assert.deepEqual(calls.at(-1), ['image', 1031, 200, 140]);
  calls.length = 0;
  drawEnding(ctx, state, artwork, { type: 'finale', elapsed: FINALE_DURATION });
  assert.deepEqual(calls.at(-1), ['image', 1031, 190, 60]);
  assert.equal(calls.filter(c => c[0] === 'fill' && String(c[1]).startsWith('rgb(')).length, 100);
  assert.equal(FINALE_DURATION, 1610);
});
