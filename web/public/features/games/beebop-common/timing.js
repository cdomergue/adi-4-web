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
