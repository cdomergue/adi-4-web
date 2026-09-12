import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  calculateSimulation,
  checkChallenge,
} from '../public/features/science/simulation-engine.js';
import { greenhouseGrowth } from '../public/features/science/greenhouse-rules.js';
const data = (id) =>
  JSON.parse(readFileSync(new URL(`../public/game/station/sim-${id}.json`, import.meta.url)));
test('compiled original greenhouse calculation agrees on all 960 input combinations', () => {
  const d = data(2);
  for (let a = 1; a <= 4; a++)
    for (let b = 1; b <= 5; b++)
      for (let c = 1; c <= 4; c++)
        for (let e = 1; e <= 4; e++)
          for (let f = 1; f <= 3; f++) {
            const selected = { ...d.cases[0].initial, 1: a, 2: b, 3: c, 4: e, 5: f };
            const expected = greenhouseGrowth(selected),
              actual = calculateSimulation(d, selected);
            for (const id of ['7', '8', '9']) assert.equal(actual.values[id], expected[id]);
          }
});
test('all 14 simulations compute bounded, existing output states for their original initial cases', () => {
  for (const id of [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15]) {
    const d = data(id);
    for (const c of d.cases) {
      const r = calculateSimulation(d, c.initial);
      for (const oid of r.resolved) {
        const o = d.objects.find((o) => o.id === oid);
        assert.ok(o.options.some((s) => s.id === r.states[oid]));
        assert.ok(Number.isFinite(r.values[oid]));
      }
      assert.ok(r.resolved.length >= d.objects.filter((o) => o.type !== 1).length);
    }
  }
});
test('dairy lookup agrees with every original TABLES row for its product output', () => {
  const d = data(1);
  for (const row of d.lookup.filter((r) => r.object === '7')) {
    const selected = { ...d.cases[0].initial };
    for (const [id, value] of Object.entries(row.conditions)) {
      selected[id] = d.objects.find((o) => o.id === id).options.find((s) => s.value === value).id;
    }
    assert.equal(calculateSimulation(d, selected).values['7'], row.value);
  }
});
test('challenge checks one complete combination, never an empty or mixed solution', () => {
  const solutions = [
    { 1: 1, 2: 2 },
    { 1: 2, 2: 1 },
  ];
  assert.equal(checkChallenge(solutions, { 1: 1, 2: 2 }), true);
  assert.equal(checkChallenge(solutions, { 1: 1, 2: 1 }), false);
  assert.equal(checkChallenge([{}], {}), false);
});
