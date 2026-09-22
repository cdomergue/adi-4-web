// 1010:3179 waits for the sound, then adds 30/120 seconds. 1028:0002
// counts the reserve bonus at 2/200 seconds per ten points.
export function createBonus(lives, manifest, sound) {
  const wait = name => (sound ? manifest.soundDurations[name] * 1000 : 0) + 250;
  const revealLives = wait('AFFBON');
  const revealBonus = revealLives + wait('KEY');
  const countStart = revealBonus + wait('KEY');
  const countEnd = countStart + lives * 100;
  return { type: 'won', elapsed: 0, remaining: lives * 100,
    revealLives, revealBonus, countStart, countEnd,
    duration: countEnd + wait('FINBON') + 500 };
}

export function bonusRemaining(p, lives) {
  return Math.max(0, lives * 100 - Math.max(0, Math.floor((p.elapsed - p.countStart) / 10)) * 10);
}

export function synchronousCue(p, manifest) {
  const cues = p.type === 'won' ? [['AFFBON', 0], ['KEY', p.revealLives],
    ['KEY', p.revealBonus], ['FINBON', p.countEnd]] :
    ['finale', 'gameover'].includes(p.type) ? [['ORAGEPTR', 0]] : [];
  for (const [name, start] of cues) {
    const end = start + manifest.soundDurations[name] * 1000;
    if (p.elapsed >= start && p.elapsed < end) return { name, start, end };
  }
  return null;
}
