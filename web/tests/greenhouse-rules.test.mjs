import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

import {greenhouseGrowth, matchSolution} from '../public/greenhouse-rules.js';

const here = dirname(fileURLToPath(import.meta.url));
const mcasPath = resolve(here, 'fixtures/greenhouse-mcas.json');
const mcas = JSON.parse(readFileSync(mcasPath, 'utf8'));

const number = (value) => Number(String(value).trim());
const records = mcas.records.filter((record) => number(record.SIMULID) === 2);

const solutionEntries = Array.from(new Map(
  records
    .filter((record) => number(record.CASID) > 0)
    .map((record) => [
      `${number(record.CASID)}:${number(record.SOLUCEID)}`,
      records
        .filter((candidate) => (
          number(candidate.CASID) === number(record.CASID)
          && number(candidate.SOLUCEID) === number(record.SOLUCEID)
      ))
        .reduce((solution, candidate) => {
          solution[String(number(candidate.OBJETID))] = number(candidate.ETATID);
          return solution;
        }, {}),
])).entries()).map(([key, values]) => ({casId: Number(key.split(':')[0]), values}));
const solutions = solutionEntries.map(({values}) => values);

test('MCAS simulation 2 contains eight complete greenhouse solutions', () => {
  assert.equal(solutions.length, 8);
  const solutionCounts = records
    .filter((record) => number(record.CASID) > 0)
    .reduce((counts, record) => {
      const casId = number(record.CASID);
      counts[casId] = counts[casId] ?? new Set();
      counts[casId].add(number(record.SOLUCEID));
      return counts;
    }, {});
  assert.deepEqual(
    Object.fromEntries(Object.entries(solutionCounts).map(([casId, ids]) => [casId, ids.size])),
    {1: 4, 2: 2, 3: 2},
  );
  for (const solution of solutions) assert.deepEqual(Object.keys(solution).sort(), ['1', '2', '3', '4', '5']);
});

test('matches every complete MCAS solution exactly', () => {
  for (const solution of solutions) assert.equal(matchSolution(solutions, {...solution}), true);
});

test('rejects a near match with one wrong value', () => {
  const nearMatch = {...solutions[0], 1: 2}; // Low watering exists, but solves none of these cases.
  assert.equal(matchSolution(solutions, nearMatch), false);
});

test('rejects values mixed from two different solutions', () => {
  const differingId = Object.keys(solutions[0]).find((id) => solutions[0][id] !== solutions[1][id]);
  const mixed = {...solutions[0], [differingId]: solutions[1][differingId]};
  assert.equal(matchSolution(solutions, mixed), false);
});

test('rejects an incomplete mapping', () => {
  const incomplete = {...solutions[0]};
  delete incomplete['5'];
  assert.equal(matchSolution(solutions, incomplete), false);
});

test('returns bounded integer growth for all 960 settings', () => {
  let count = 0;
  for (let water = 1; water <= 4; water += 1) {
    for (let temperature = 1; temperature <= 5; temperature += 1) {
      for (let light = 1; light <= 4; light += 1) {
        for (let co2 = 1; co2 <= 4; co2 += 1) {
          for (let minerals = 1; minerals <= 3; minerals += 1) {
            const growth = greenhouseGrowth({1: water, 2: temperature, 3: light, 4: co2, 5: minerals});
            assert.deepEqual(Object.keys(growth).sort(), ['7', '8', '9']);
            assert.ok(Number.isInteger(growth['7']) && growth['7'] >= 0 && growth['7'] <= 6);
            assert.ok(Number.isInteger(growth['8']) && growth['8'] >= 0 && growth['8'] <= 7);
            assert.ok(Number.isInteger(growth['9']) && growth['9'] >= 0 && growth['9'] <= 4);
            count += 1;
          }
        }
      }
    }
  }
  assert.equal(count, 960);
});

test('MCAS solutions include the maximum growth for each corresponding case plant', () => {
  const maximumByCase = {1: 0, 2: 0, 3: 0};
  for (const {casId, values} of solutionEntries) {
    const growth = greenhouseGrowth(values);
    const plant = {1: '7', 2: '9', 3: '8'}[casId];
    maximumByCase[casId] = Math.max(maximumByCase[casId], growth[plant]);
  }
  assert.deepEqual(maximumByCase, {1: 6, 2: 4, 3: 7});
});

test('the no-watering state produces no growth', () => {
  const growth = greenhouseGrowth({1: 1, 2: 4, 3: 3, 4: 3, 5: 2});
  assert.ok(Object.values(growth).every((value) => value === 0));
});

test('darkness blocks tomatoes and strawberries but not mushrooms', () => {
  const growth = greenhouseGrowth({1: 3, 2: 4, 3: 1, 4: 3, 5: 2});
  assert.ok(growth['7'] === 0);
  assert.ok(growth['8'] === 0);
  assert.ok(growth['9'] > 0);
});

test('rejects settings outside their input bounds', () => {
  for (const [id, value] of [['1', 0], ['1', 5], ['2', 0], ['2', 6], ['3', 0], ['3', 5], ['4', 0], ['4', 5], ['5', 0], ['5', 4]]) {
    assert.throws(() => greenhouseGrowth({...solutions[0], [id]: value}), RangeError);
  }
});
