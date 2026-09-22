import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lossCommands } from '../public/features/games/beebop2/death-lines.js';
import { createBonus, bonusRemaining, synchronousCue } from '../public/features/games/beebop2/presentation.js';

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const campaign = json('../public/game/beebop2/campaign.json');
const art = json('../public/game/beebop2/artwork.json');
const sequences = json('../public/game/beebop2/presentation.json');

test('BeeBop II: Go restores the menu background before the first animated blit', () => {
  // Native 1000:16d7: speed preview, ranking, controls and title. These
  // restores happen in the click handler, before 1000:19b2 moves the scenery.
  assert.deepEqual(sequences.menuExit.slice(0, 4), [
    ['background', 0, 100, 250, 310],
    ['background', 400, 100, 640, 310],
    ['background', 240, 290, 410, 326],
    ['background', 246, 43, 411, 76],
  ]);
});

test('BeeBop II: loss blits and ray rebuilding match 274 native sequences', () => {
  // DrawIcon does not scale to the right/bottom RECT fields.
  const normalize = commands => commands.map(c => c[0] === 'icon' ? c.slice(0, 4) : c);
  for (const f of json('./fixtures/beebop2-presentation.json')) {
    const rules = { ...campaign.levels.find(l => l.id === f.stage).config };
    if (f.stage === 17) rules['0d12'] = 0;
    assert.deepEqual(normalize(lossCommands({ rules }, f)), normalize(f.commands),
      `stage ${f.stage}, ball ${f.x},${f.y}`);
  }
});

test('BeeBop II: original presentation references exist and waits are finite', () => {
  assert.deepEqual(Object.keys(sequences).sort(), ['atom', 'entry', 'exit', 'gameover', 'menuExit']);
  for (const commands of Object.values(sequences)) for (const [op, ...args] of commands) {
    assert.ok(['wait', 'icon', 'background', 'copy', 'fill', 'ellipse'].includes(op));
    assert.ok(args.every(Number.isFinite));
    if (op === 'icon') assert.ok(art.icons[args[0]], `icon ${args[0]}`);
    if (op === 'wait') assert.ok(args[0] >= 0);
  }
});

test('BeeBop II: bonus counts ten points per 10ms after synchronous cues', () => {
  for (const sound of [false, true]) {
    const p = createBonus(6, art, sound);
    assert.equal(p.revealLives, 250 + (sound ? art.soundDurations.AFFBON * 1000 : 0));
    assert.equal(bonusRemaining(p, 6), 600);
    p.elapsed = p.countStart + 310;
    assert.equal(bonusRemaining(p, 6), 290);
    p.elapsed = p.countEnd;
    assert.equal(bonusRemaining(p, 6), 0);
    if (sound) assert.equal(synchronousCue(p, art).name, 'FINBON');
  }
});
