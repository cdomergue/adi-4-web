import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLevelFlags, requiredPatternOffsets, updateLevelRules, updatePaddleHeight,
} from '../public/features/games/beebop/level-rules.js';

// Native Pascal payloads, segment 1028 (length byte excluded), BEEBOP1.EXE.
// Embedded evidence keeps these tests independent of the asset export/runtime.
const patterns = {
  0x102a: '2222222222222222200000200006000220000020117711022000002010000102200000201000010225555520100001022111111011111102200000000000000220000000000000022222222555555555',
  0x116e: '0000222222220000011020000002011001102000000201100110200000020110000020000002000022222555555222220000000000000000000000000000000000100010001000102255555555555522',
  0x1210: '0000222222220000000000000002011000000000000201100000000000020110000000000002000022222555555222220000000000000000000000000000000000100010001000102255555555555522',
  0x12b2: '0000222222220000000000000000000000000000000000000000000000000000000000000000000022222555555222220000000000000000000000000000000000100010001000102255555555555522',
  0x153a: '2222220002222222211112222200200222222202020020022000020202000002200002222200000220000202020000022000022222000002200000000000000220000000000000022555522222555552',
  0x167e: '2222222222222222200000000000000220000000000000022000000000000002200000000000000220000000000000022555555555555552111111111111111100000000000000000000000000000000',
  0x17c2: '2222222222222222211211211211211221121121121121122112112112112112222222222222222200000022220000000000002772000000000000222200000000000000000000000000000000000000',
  0x1864: '2222222222222222211211211211211221121121121121122112112112112112222222222222222200000000000000000000000000000000000000000000000000000000000000000000000000000000',
  0x1cd2: '2222222222222222202020221111111220202022000600025000002270111012500000500000000250000050000000025000005000000002500000500000000220000050000000022222222222222222',
  0x1eb8: '222222222222222220000021121721122000002b117111b220ZZZ0271111117220Z7Z02ZZZZZZZZ220ZZZ02ZZZZZZZZ22222222222222222000000000000000000000000000000000000000000000000',
  0x1f5a: '222222222222222220000021121721122000002b117111b220000027111111722000002ZZZZZZZZ22000002ZZZZZZZZ22000002222222222000000000000000000000000000000000000000000000000',
  0x209e: 'ZZZZZZZb7ZZ212ZZZ11111Z7bZZ212ZZZZZZZZZ22ZZ212ZZZZZZZZZ22ZZ212ZZZZZ1ZZZ22ZZ212ZZZZZ1ZZZ22ZZ212ZZZZZZZZZ220000000222222200222222200000000000000000000000000000000',
  0x2326: '200021112111111120002111211111b120002000200000002000200020000000255525552555555522222222222200007111111111170000711111111117000000000000000000000000000000000000',
  0x23c8: '200000002111111120000000211111b120000000200000002000000020000000255525552555555522222222222200007111111111170000711111111117000000000000000000000000000000000000',
  0x246a: '2000000000000000200000000000000020000000000000002000000000000000255525552555555522222222222200007111111111170000711111111117000000000000000000000000000000000000',
  0x26f2: '0000002000000000000000201111111000000020111111100055002011111110555555201111100071111720111000550000002010005555000000200055555500000020555555555555555555555555',
  0x2794: '0000002000000000000000201111111000000020111111100000002011111110000000201111100000000020111000550000002010005555000000200055555500000020555555555555555555555555',
  0x28d8: '0000000000000000000000000000000000000000000000000000000220000000000002222220000055555227722555550000001111000000111111111111111100000000000000000000000000000000',
  0x2e8a: '2222222222222222200002222220000220000222222011022000021771201102200002111120110220000211112011022000020000200002200002000020000225555255552555522222222222222222',
  0x2f2c: '2222222222222222200002222220000220000222222011022000000000201102200000000020110220000000002011022000000000200002200000000020000225555255552555522222222222222222',
  0x3070: '0000000000000000000000000000000000000000000000005552222222255555777111111111111100000000000000005555522222222222111711111111111100000000000000000000000000000000',
  0x3112: '0000000000000000000000000000000000000000000000000002222222255555000000000000000000000000000000005555522222222222111711111111111100000000000000000000000000000000',
  0x3256: '000000000000022200005000000002520000000011100202111120001b100202111120001110020211112000000002021111222222222202000050000000000000005000000000000000500000000000',
  0x32f8: '000000000000022200005000000002520000000011100202000020001b100202000020001110020200002000000002020000222222222202000000000000000000000000000000000000000000000000',
  0x343c: '22222222222222222000055555500002200005000050110220000500005011022000020bb020110220000200002011022000020000200002200002000020000225555255552555522222222222222222',
  0x3580: '2222222222222222200200020002000220020702070207022002000200020002200211121112111220021112111211122002111211121112200200020002000220020002000200022002000200020002',
  0x3622: '2222222222222222200200020002000220020002070207022002000200020002200200021112111220020002111211122002000211121112200000020002000220000002000200022000000200020002',
  0x36c4: '2222222222222222200200020002000220020002000207022002000200020002200200020002111220020002000211122002000200021112200000000002000220000000000200022000000000020002',
  0x3b32: '2222222002222222212120000002121221212000000212122121200000021212212120000002121221212000000212122121255555521212200000000000000220000000000000022000000000000002',
  0x3c76: '2222222211111111000000021ZZZZZZ1000000021Z0770Z1000000021ZZZZZZ1000000022222222200000002111111110000000200000000000000020000000000000002000000000000000200000000',
  0x3d18: '2222222211111111000000021ZZZZZZ1000000021Z0770Z1000000021ZZZZZZ1000000022222222200000000000000000000000000000000000000000000000000000000000000000000000000000000',
  0x3e5c: '1001200000021001011020000002011001102000000201102222200000022222000220000002200000000000000000000000000000000000200000000000000220000000000000022000000000000002',
};

function game(levelId, cells = Array(160).fill('2')) {
  return {
    levelId, cells: [...cells], targetCells: Array(160).fill('5'),
    paddle: { x: 150, previousX: 147, y: 273, width: 30, leftInset: 60, rightInset: 390 },
    bounds: { left: 15, right: 495, top: 11, bottom: 306 },
    flags: {}, events: [], laser: true, enemyEnabled: false,
  };
}
const range = (start, count, step = 1) => Array.from({ length: count }, (_, i) => start + i * step);
const transitions = (state) => state.events.filter((event) => event.type === 'level-transition');
const sounds = (state) => state.events.filter((event) => event.type === 'sound');

// Independent expected 0-based indices and final writes from 1008:9232.
// Every native pattern branch is exercised, including later branches in isolation.
const cases = [
  [5, 0x102a, range(81, 5), { y: 271, leftInset: 30, rightInset: 30 }],
  [6, 0x116e, range(20, 4, 16), { leftInset: 0 }],
  [6, 0x1210, range(27, 4, 16), { leftInset: 0, rightInset: 0 }],
  [6, 0x12b2, range(80, 16), { leftInset: 0, rightInset: 0, y: 242 }],
  [7, 0x153a, range(33, 4), { leftInset: 30, rightInset: 30 }],
  [8, 0x167e, range(97, 14), { leftInset: 0, rightInset: 0, y: 303 }],
  [9, 0x17c2, [...range(86, 4), ...range(118, 4), 102, 105], {}],
  [9, 0x1864, range(64, 16), {}],
  [15, 0x1cd2, range(70, 5, 16), { rightInset: 30 }],
  [17, 0x1eb8, range(97, 5), {}],
  [17, 0x1f5a, range(103, 8), {}],
  [18, 0x209e, [...range(112, 7), ...range(121, 7)], {}],
  [21, 0x2326, range(4, 4, 16), { leftInset: 30, rightInset: 270 }],
  [21, 0x23c8, range(8, 4, 16), { leftInset: 30, rightInset: 150 }],
  [21, 0x246a, range(73, 7), { leftInset: 0, rightInset: 0, y: 303 }],
  [24, 0x26f2, [50, 51, ...range(64, 6)], { y: 272 }],
  [24, 0x2794, range(86, 4, 16), { rightInset: 0 }],
  [24, 0x246a, range(73, 7), { leftInset: 0, rightInset: 0, y: 303 }],
  [25, 0x28d8, [...range(80, 5), ...range(91, 5)], { y: 301 }],
  [32, 0x2e8a, range(53, 5, 16), { rightInset: 180 }],
  [32, 0x2f2c, range(58, 5, 16), { rightInset: 30 }],
  [33, 0x3070, range(48, 3), { y: 363 }],
  [33, 0x3112, range(96, 5), { y: 393 }],
  [34, 0x3256, range(116, 3, 16), { leftInset: 0 }],
  [34, 0x32f8, [20], {}],
  [35, 0x343c, [...range(69, 4, 16), ...range(74, 4, 16)], { rightInset: 30 }],
  [36, 0x3580, range(115, 3, 16), { rightInset: 270 }],
  [36, 0x3622, range(119, 3, 16), { rightInset: 150 }],
  [36, 0x36c4, range(123, 3, 16), { rightInset: 30 }],
  [42, 0x3b32, range(101, 6), { leftInset: 30, rightInset: 30, y: 303 }],
  [43, 0x3c76, range(87, 5, 16), { rightInset: 0, y: 303 }],
  [43, 0x3d18, range(72, 8), { rightInset: 0, y: 303 }],
  [44, 0x3e5c, [...range(48, 4), ...range(60, 4)], {}],
];

for (const [levelId, offset, indices, writes] of cases) {
  test(`native level ${levelId}, pattern 1028:${offset.toString(16)}`, () => {
    const state = game(levelId, patterns[offset]);
    const cells = state.cells, target = state.targetCells, paddle = state.paddle;
    const previous = [...cells];
    const expectedPaddle = { ...paddle, ...writes, previousX: 10000 };
    assert.equal(updateLevelRules(state, patterns), state);
    assert.equal(state.cells, cells);
    assert.equal(state.targetCells, target);
    assert.equal(state.paddle, paddle);
    assert.deepEqual(state.paddle, expectedPaddle);
    assert.deepEqual(state.cells, previous.map((c, i) => indices.includes(i) ? '0' : c));
    assert.deepEqual(state.targetCells, range(0, 160).map(i => indices.includes(i) ? '0' : '5'));
    assert.deepEqual(transitions(state).map(e => e.patternOffset), [offset]);
    assert.deepEqual(sounds(state), [{ type: 'sound', sound: 'disp', source: '1000:1c6b' }]);
    assert.deepEqual(state.events.find(e => e.source === '1000:1c6b' && e.rect).rect,
      { x: 147, y: 273, width: 30, height: 6 });
    assert.equal(state.flags['48fe'], offset === 0x2794 ? 1 : 0);
    assert.equal(state.flags['4900'], offset === 0x28d8 ? 1 : 0);
    // ZF compares the entire string: a difference even in the last cell fails.
    const mismatch = game(levelId, patterns[offset]);
    mismatch.cells[159] = 'X';
    updateLevelRules(mismatch, patterns);
    assert.equal(transitions(mismatch).length, 0);
  });
}

test('all 32 exported pattern offsets and all 33 call sites are covered', () => {
  const used = range(1, 45).flatMap(requiredPatternOffsets);
  assert.equal(used.length, 33);
  assert.deepEqual([...new Set(used)].sort((a, b) => a - b),
    Object.keys(patterns).map(Number).sort((a, b) => a - b));
  assert.deepEqual(used.sort((a, b) => a - b), cases.map(c => c[1]).sort((a, b) => a - b));
  assert.deepEqual(requiredPatternOffsets(26), []);
});

test('patterns accept campaign hex keys; malformed/missing patterns fail before mutation', () => {
  const hex = Object.fromEntries(Object.entries(patterns).map(([k, v]) => ['0x' + Number(k).toString(16), v]));
  const state = game(6, patterns[0x1210]);
  updateLevelRules(state, hex);
  assert.equal(transitions(state)[0].patternOffset, 0x1210);
  for (const bad of [undefined, patterns[0x102a].slice(1), patterns[0x102a] + '0']) {
    const input = game(5, patterns[0x102a]), before = structuredClone(input);
    assert.throws(() => updateLevelRules(input, { [0x102a]: bad }), /1028:102a/);
    assert.deepEqual(input, before);
  }
  for (const bad of ['0'.repeat(160), Array(160), Array(159).fill('0')]) {
    assert.throws(() => updateLevelRules({ ...game(1), cells: bad }), /160 ASCII/);
  }
});

test('fresh comparisons cascade within one invocation, without requiring earlier matches', () => {
  const state = game(6, '2'.repeat(160));
  const first = state.cells.join('');
  const second = [...first];
  for (const i of range(20, 4, 16)) second[i] = '0';
  const third = [...second];
  for (const i of range(27, 4, 16)) third[i] = '0';
  updateLevelRules(state, { 4462: first, 4624: second.join(''), 4786: third.join('') });
  assert.deepEqual(transitions(state).map(e => e.patternOffset), [0x116e, 0x1210, 0x12b2]);
  assert.equal(state.paddle.y, 242);
  assert.equal(sounds(state).length, 3);
  // Second transition uses invalidated old draw position, as the native helper does.
  assert.deepEqual(state.events.filter(e => e.source === '1000:1c6b' && e.rect)
    .map(e => e.rect.x), [147, 10000, 10000]);
});

test('transition bonus writes disable laser and level 15 enables enemy contact', () => {
  for (const [levelId, offset] of [[15, 0x1cd2], [33, 0x3112], [36, 0x3622], [36, 0x36c4]]) {
    const state = game(levelId, patterns[offset]);
    state.missile = { x: 100, y: 90 };
    updateLevelRules(state, patterns);
    assert.equal(state.laser, false);
    assert.equal(state.bonusPanelDrawn, false);
    assert.equal(state.enemyEnabled, levelId === 15);
    assert.deepEqual(state.missile, { x: 100, y: 90 }); // No native projectile reset here.
    assert.deepEqual(state.events.filter(e => e.type === 'native-write')
      .map(({ address, value }) => [address, value]), [
      ...(levelId === 15 ? [[0x48ee, 'oui']] : []), [0x48ea, 'non'], [0x088e, 0],
    ]);
    assert.deepEqual(state.events.find(e => e.type === 'fill-rect').rect,
      { x: 222, y: 325, width: 67, height: 22 });
  }
});

test('level 29 tests both stages in order, then stops changing the paddle', () => {
  const state = game(29);
  for (const i of range(34, 4)) state.cells[i] = '0';
  updateLevelRules(state);
  assert.equal(state.flags['4908'], 1);
  assert.equal(state.paddle.leftInset, 270);
  assert.equal(state.paddle.rightInset, 30);
  for (const i of [...range(25, 6), ...range(41, 6), ...range(57, 6)]) state.cells[i] = '0';
  updateLevelRules(state);
  assert.equal(state.flags['4908'], 2);
  assert.equal(state.paddle.y, 271);
  assert.equal(sounds(state).length, 2);
  updateLevelRules(state);
  assert.equal(sounds(state).length, 2);
  const both = game(29, '0'.repeat(160));
  updateLevelRules(both);
  assert.equal(both.flags['4908'], 2);
  assert.equal(sounds(both).length, 2);
});

test('level 27 gates the two cell removals independently and emits no sound', () => {
  const state = game(27);
  const secondGuard = [84, 85, 100, 101, 96, 97, 112, 113];
  for (const i of secondGuard) state.cells[i] = '0';
  updateLevelRules(state);
  assert.equal(state.flags['4904'], 0);
  for (const i of [20, 21, 22]) state.cells[i] = '0';
  updateLevelRules(state);
  assert.equal(state.flags['4906'], 1);
  assert.equal(state.flags['4904'], 1);
  assert.equal(state.paddle.rightInset, 0);
  assert.equal(sounds(state).length, 0);
  assert.equal(state.paddle.previousX, 147);
  for (const i of [...range(51, 6), ...range(9, 7, 16)]) {
    assert.equal(state.cells[i], '0');
    assert.equal(state.targetCells[i], '0');
  }
  const count = state.events.length;
  updateLevelRules(state);
  assert.equal(state.events.length, count);
});

test('level 26 changes target frame first; live frame disappears only on full equality', () => {
  const state = game(26);
  for (const i of range(34, 5)) state.cells[i] = '0';
  state.targetCells = [...state.cells];
  const frame = [...range(17, 7), ...range(81, 7), ...range(33, 3, 16), ...range(39, 3, 16)];
  state.cells[0] = '1'; // Unfinished brick outside the ignored frame.
  updateLevelRules(state);
  assert.equal(state.flags['4902'], 1);
  assert.equal(state.paddle.y, 272);
  assert.equal(state.targetCells[17], '2'); // First call does not touch the frame.
  updateLevelRules(state);
  for (const i of frame) {
    assert.equal(state.targetCells[i], '0');
    assert.equal(state.cells[i], '2');
  }
  assert.equal(state.cells[0], '1');
  state.cells[0] = '2';
  const cells = state.cells;
  updateLevelRules(state);
  assert.equal(state.cells, cells);
  assert.deepEqual(state.cells, state.targetCells);
  assert.equal(sounds(state).length, 1);
  assert.equal(state.events.filter(e => e.source === '1008:9232').length, 0);
});

function altitude(levelId, x, y = 299, flags = {}) {
  const state = game(levelId);
  state.paddle.x = x;
  state.paddle.y = y;
  state.flags = flags;
  const paddle = state.paddle;
  assert.equal(updatePaddleHeight(state), state);
  assert.equal(state.paddle, paddle);
  assert.equal(state.paddle.previousY, y);
  assert.equal(sounds(state).length, 0);
  return state;
}

test('level 22 exact edge equality and every staircase boundary', () => {
  const cases = [
    [15, 272], [16, 242], [44, 242], [45, 212], [74, 212], [75, 182],
    [104, 182], [105, 152], [134, 152], [135, 122], [164, 122], [165, 92],
    [315, 92], [316, 122], [345, 122], [346, 152], [375, 152], [376, 182],
    [405, 182], [406, 212], [435, 212], [436, 242], [464, 242], [465, 272],
    [466, 242], // Preserve the equality test, not a generalized outside test.
  ];
  for (const [x, y] of cases) assert.equal(altitude(22, x).paddle.y, y, String(x));
});

test('level 23 right staircase uses strict greater-than comparisons', () => {
  for (const [x, y] of [[224, 182], [225, 182], [226, 212],
    [315, 212], [316, 242], [405, 242], [406, 272]]) {
    assert.equal(altitude(23, x).paddle.y, y, String(x));
  }
});

test('level 24 slope requires its flag and retains y past the final threshold', () => {
  assert.equal(altitude(24, 150).paddle.y, 299);
  for (const [x, y] of [[224, 272], [225, 242], [284, 242], [285, 212],
    [344, 212], [345, 182], [404, 182], [405, 152], [464, 152], [465, 299]]) {
    assert.equal(altitude(24, x, 299, { '48fe': 1 }).paddle.y, y, String(x));
  }
  const final = game(24, patterns[0x246a]);
  final.flags['48fe'] = 1;
  final.paddle.x = 150;
  updateLevelRules(final, patterns);
  assert.equal(final.paddle.y, 303);
  updatePaddleHeight(final);
  assert.equal(final.paddle.y, 272); // Final transition does not reset 48fe.
});

test('levels 25 and 27 preserve asymmetric steps and the level 25 disable flag', () => {
  for (const [id, steps] of [
    [25, [[134, 151], [135, 121], [194, 121], [195, 91], [285, 91],
      [286, 121], [345, 121], [346, 151]]],
    [27, [[134, 301], [135, 271], [164, 271], [165, 241], [194, 241],
      [195, 211], [345, 211], [346, 241], [405, 241], [406, 271],
      [435, 271], [436, 301]]],
  ]) for (const [x, y] of steps) assert.equal(altitude(id, x).paddle.y, y, id + ':' + x);
  assert.equal(altitude(25, 200, 301, { '4900': 1 }).paddle.y, 301);
});

test('height steps use native bounds, ignore width, and erase only changed altitude', () => {
  const state = game(22);
  state.bounds.left = 105;
  state.bounds.right = 405;
  state.paddle.width = 60;
  state.paddle.x = 105;
  updatePaddleHeight(state);
  assert.equal(state.paddle.y, 272);
  assert.deepEqual(state.events[0].rect, { x: 147, y: 273, width: 60, height: 6 });
  const count = state.events.length;
  updatePaddleHeight(state);
  assert.equal(state.events.length, count);
  assert.equal(state.paddle.previousY, 272);
  assert.equal(altitude(10, 105).paddle.y, 299);
});

test('flags are independent objects; unknown state and existing events are retained', () => {
  const first = createLevelFlags(), second = createLevelFlags();
  first['4908'] = 2;
  assert.equal(second['4908'], 0);
  const state = game(1);
  state.flags.extra = 9;
  state.events.push({ type: 'previous' });
  updateLevelRules(state);
  updatePaddleHeight(state);
  assert.deepEqual(state.events, [{ type: 'previous' }]);
  assert.equal(state.flags.extra, 9);
});
