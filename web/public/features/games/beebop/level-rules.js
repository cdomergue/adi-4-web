/**
 * BeeBop I, native internal level ids (1028:492e), not presentation order.
 * Sources: BEE1.EXE 1008:9232..ab8d (transitions), 1000:1cfd..1ffb
 * (altitude), 1008:23e0 (movement bounds), 1000:1c6b/1cc2 (paddle erase).
 *
 * API: updateLevelRules(state, patterns), updatePaddleHeight(state) mutate and
 * return state, retaining paddle/array identities, like engine.js. No DOM or IO.
 * Events append to state.events; the caller drains them once per frame. State contains:
 *   levelId, cells, targetCells: two normalized arrays of 160 ASCII characters;
 *   bounds: {left, right, top, bottom} in original screen coordinates;
 *   paddle: {x, y, width, leftInset, rightInset, previousX?, previousY?};
 *   flags: createLevelFlags() (or {}), events: [].
 * cells[0] = 1028:1355, targetCells[0] = 1028:13f7 (Pascal headers excluded).
 * The engine initializes bounds (normally 15,495,11,306; narrowed level 10
 * uses 105,405,11,306), insets and both grids from the exported native data.
 *
 * patterns = { [segment-1028 offset]: exact ASCII string of length 160 }.
 * Keys may be decimal (15154) or lowercase prefixed hexadecimal ('0x3b32').
 * See requiredPatternOffsets(levelId). Do NOT normalize patterns a second time.
 * Missing/malformed required patterns throw instead of disabling a transition.
 * 1020:0b84 uses REPE CMPSB at 0ba4, then CMP AL,AH at 0ba8 if the prefix
 * matches. ZF means equal bytes AND lengths. Each call site in 1008:9232 tests
 * fresh ZF, independently of the previous branch (Ghidra's booleans are wrong).
 * Later comparisons see earlier edits during the SAME invocation.
 *
 * Events are ordered native effects, not performed browser operations:
 * - sound {sound:'disp', source}: 1000:1c6b; caller applies sound preferences.
 * - restore-background {rect:{x,y,width,height}, source}: native 1010:2605.
 * - fill-rect {rect,colorIndex,source}: native 1010:2996 (bonus panel).
 * - native-write {address,value}: bonus state 48ea='non', 48ee='oui', 088e=0;
 *   these writes also set laser=false, enemyEnabled=true, bonusPanelDrawn=false,
 *   respectively. Address keys are numbers; values retain Pascal spelling.
 * - level-transition {levelId,patternOffset?}: identifies an executed branch.
 * flags uses native hex-address keys for the six persistent counters.
 * Their lifetime/reset belongs to the engine (native outer loop 1008:baed),
 * not to this module; do not implicitly reset them at each transition.
 *
 * Integration order: clamp paddle x using bounds + insets and width, call
 * updatePaddleHeight on native movement (1008:23e0), resolve frame collisions,
 * call updateLevelRules once, then compare cells to targetCells for completion
 * (1008:8fa5). No fixed-point loop, automatic win, or extra x clamp here.
 * The native movement check can be forced by paddle.previousX=10000, written
 * by transition erasure; this matters even when the pointer has not moved.
 *
 * Scope: episode I only. Collision/brick normalization, bonus execution, audio,
 * drawing and frame scheduling are the caller's responsibility. This module
 * emits their native effects; it does not claim runtime audiovisual parity.
 */

const gridBase = 0x1355;
const run = (address, count, step = 1) =>
  Array.from({ length: count }, (_, i) => address - gridBase + i * step);

// Tuples: pattern offset, cleared native cell runs, paddle writes, optional
// effects. Native addresses keep the transcription auditable; indices are 0-based.
const rules = {
  42: [[0x3b32, run(0x13ba, 6), { rightInset: 30, leftInset: 30, y: 303 }]],
  43: [
    [0x3c76, run(0x13ac, 5, 16), { rightInset: 0, y: 303 }],
    [0x3d18, run(0x139d, 8), { rightInset: 0, y: 303 }],
  ],
  44: [[0x3e5c, [...run(0x1385, 4), ...run(0x1391, 4)], {}]],
  36: [
    [0x3580, run(0x13c8, 3, 16), { rightInset: 270 }],
    [0x3622, run(0x13cc, 3, 16), { rightInset: 150 }, { bonusBefore: true }],
    [0x36c4, run(0x13d0, 3, 16), { rightInset: 30 }, { bonusBefore: true }],
  ],
  35: [[0x343c, [...run(0x139a, 4, 16), ...run(0x139f, 4, 16)], { rightInset: 30 }]],
  34: [
    [0x3256, run(0x13c9, 3, 16), { leftInset: 0 }],
    [0x32f8, run(0x1369, 1), {}],
  ],
  33: [
    [0x3070, run(0x1385, 3), {}, { deltaY: 90 }],
    [0x3112, run(0x13b5, 5), {}, { deltaY: 120, bonusBefore: true }],
  ],
  25: [[0x28d8, [...run(0x13a5, 5), ...run(0x13b0, 5)], { y: 301 }, { flag: '4900' }]],
  18: [[0x209e, [...run(0x13c5, 7), ...run(0x13ce, 7)], {}]],
  7: [[0x153a, run(0x1376, 4), { rightInset: 30, leftInset: 30 }]],
  6: [
    [0x116e, run(0x1369, 4, 16), { leftInset: 0 }],
    [0x1210, run(0x1370, 4, 16), { leftInset: 0, rightInset: 0 }],
    [0x12b2, run(0x13a5, 16), { leftInset: 0, rightInset: 0, y: 242 }],
  ],
  32: [
    [0x2e8a, run(0x138a, 5, 16), { rightInset: 180 }],
    [0x2f2c, run(0x138f, 5, 16), { rightInset: 30 }],
  ],
  24: [
    [0x26f2, [...run(0x1387, 2), ...run(0x1395, 6)], { y: 272 }],
    [0x2794, run(0x13ab, 4, 16), { rightInset: 0 }, { flag: '48fe' }],
    [0x246a, run(0x139e, 7), { y: 303, rightInset: 0, leftInset: 0 }],
  ],
  21: [
    [0x2326, run(0x1359, 4, 16), { leftInset: 30 }, { deltaRightInset: -120 }],
    [0x23c8, run(0x135d, 4, 16), { leftInset: 30 }, { deltaRightInset: -240 }],
    [0x246a, run(0x139e, 7), { y: 303, rightInset: 0, leftInset: 0 }],
  ],
  17: [
    [0x1eb8, run(0x13b6, 5), {}],
    [0x1f5a, run(0x13bc, 8), {}],
  ],
  8: [[0x167e, run(0x13b6, 14), { rightInset: 0, leftInset: 0, y: 303 }]],
  9: [
    [0x17c2, [...run(0x13ab, 4), ...run(0x13cb, 4), ...run(0x13bb, 2, 3)], {}],
    [0x1864, run(0x1395, 16), {}],
  ],
  15: [[0x1cd2, run(0x139b, 5, 16), { rightInset: 30 }, { bonusAfter: true }]],
  5: [[0x102a, run(0x13a6, 5), { y: 271, rightInset: 30, leftInset: 30 }]],
};

export function requiredPatternOffsets(levelId) {
  return (rules[levelId] ?? []).map(([offset]) => offset);
}

export function createLevelFlags() {
  return { '48fe': 0, '4900': 0, '4902': 0, '4904': 0, '4906': 0, '4908': 0 };
}

function assertCells(cells, label) {
  if (!Array.isArray(cells) || cells.length !== 160 ||
      !Array.from(cells).every((cell) => typeof cell === 'string' && cell.length === 1 &&
        cell.charCodeAt(0) <= 127)) {
    throw new TypeError(`${label} must contain 160 ASCII characters`);
  }
}

function prepareState(state) {
  state.flags ??= {};
  for (const [key, value] of Object.entries(createLevelFlags())) state.flags[key] ??= value;
  state.events ??= [];
  return state;
}

function patternAt(patterns, offset) {
  return patterns[offset] ?? patterns[`0x${offset.toString(16)}`];
}

function restore(state, rect, source) {
  state.events.push({ type: 'restore-background', rect, source });
}

function erasePaddle(state, sound) {
  const { x, previousX = x, y, width } = state.paddle;
  const source = sound ? '1000:1c6b' : '1000:1cc2';
  if (sound) state.events.push({ type: 'sound', sound: 'disp', source });
  restore(state, { x: previousX, y, width, height: 6 }, source);
  if (sound) state.paddle.previousX = 10000;
}

function clearCells(state, indices) {
  for (const index of indices) {
    state.cells[index] = '0';
    state.targetCells[index] = '0';
  }
}

// All transition restore rectangles are exactly the contiguous row/column runs
// they clear. Merge adjacent cells only along the direction of the native run.
function restoreRuns(state, indices) {
  let start = 0;
  while (start < indices.length) {
    const first = indices[start];
    const next = indices[start + 1];
    const step = next === first + 16 ? 16 : 1;
    let end = start + 1;
    while (end < indices.length && indices[end] === indices[end - 1] + step &&
      (step === 16 || Math.floor(indices[end] / 16) === Math.floor(first / 16))) end++;
    const count = end - start;
    restore(state, {
      x: state.bounds.left + (first % 16) * 30,
      y: state.bounds.top + Math.floor(first / 16) * 30,
      width: step === 1 ? count * 30 : 30,
      height: step === 16 ? count * 30 : 30,
    }, '1008:9232');
    start = end;
  }
}

function bonusWrites(state, enableSecondary = false) {
  const write = (address, value) => state.events.push({ type: 'native-write', address, value });
  if (enableSecondary) {
    write(0x48ee, 'oui');
    state.enemyEnabled = true;
  }
  write(0x48ea, 'non');
  write(0x088e, 0);
  state.laser = false;
  state.bonusPanelDrawn = false;
}

function clearBonusPanel(state) {
  state.events.push({
    type: 'fill-rect', colorIndex: 14, source: '1010:2996',
    rect: { x: 222, y: state.bounds.bottom + 19, width: 67, height: 22 },
  });
}

function transition(state, patternOffset) {
  state.events.push({ type: 'level-transition', levelId: state.levelId, patternOffset });
}

/** One native 1008:9232 invocation. All required patterns are validated first. */
export function updateLevelRules(input, patterns = {}) {
  assertCells(input.cells, 'state.cells');
  assertCells(input.targetCells, 'state.targetCells');
  for (const offset of requiredPatternOffsets(input.levelId)) {
    const pattern = patternAt(patterns, offset);
    if (typeof pattern !== 'string' || pattern.length !== 160 || /[^\x00-\x7f]/.test(pattern)) {
      throw new TypeError(`Missing/invalid BeeBop I pattern 1028:${offset.toString(16)}`);
    }
  }
  const state = prepareState(input);
  const flags = state.flags;
  const empty = (indices) => indices.every((index) => state.cells[index] === '0');

  for (const [offset, indices, paddle, effects = {}] of rules[state.levelId] ?? []) {
    if (state.cells.join('') !== patternAt(patterns, offset)) continue;
    transition(state, offset);
    if (effects.bonusBefore) {
      clearBonusPanel(state);
      bonusWrites(state);
    }
    erasePaddle(state, true);
    Object.assign(state.paddle, paddle);
    if (effects.deltaY) state.paddle.y += effects.deltaY;
    if (effects.deltaRightInset) state.paddle.rightInset += effects.deltaRightInset;
    if (effects.flag) flags[effects.flag] = 1;
    if (effects.bonusAfter) bonusWrites(state, true);
    clearCells(state, indices);
    restoreRuns(state, indices);
    if (effects.bonusAfter) clearBonusPanel(state);
  }

  // 1008:9a3c: two independent tests, with an explicit stage counter.
  if (state.levelId === 29) {
    if (flags['4908'] === 0 && empty(run(0x1377, 4))) {
      flags['4908'] = 1;
      transition(state);
      erasePaddle(state, true);
      Object.assign(state.paddle, { rightInset: 30, leftInset: 270 });
    }
    if (flags['4908'] === 1 && empty([
      ...run(0x136e, 6), ...run(0x137e, 6), ...run(0x138e, 6),
    ])) {
      flags['4908'] = 2;
      transition(state);
      erasePaddle(state, true);
      Object.assign(state.paddle, { rightInset: 0, leftInset: 0, y: 271 });
    }
  }

  // 1008:9b34: no paddle erase or sound in either level-27 branch.
  if (state.levelId === 27) {
    if (flags['4906'] !== 1 && empty(run(0x1369, 3))) {
      flags['4906'] = 1;
      transition(state);
      const indices = run(0x1388, 6);
      clearCells(state, indices);
      restoreRuns(state, indices);
    }
    if (flags['4904'] !== 1 && flags['4906'] === 1 && empty([
      ...run(0x13a9, 2), ...run(0x13b9, 2), ...run(0x13b5, 2), ...run(0x13c5, 2),
    ])) {
      flags['4904'] = 1;
      state.paddle.rightInset = 0;
      transition(state);
      const indices = run(0x135e, 7, 16);
      clearCells(state, indices);
      restoreRuns(state, indices);
    }
  }

  // 1008:a198..a2e4: the temporary grid is 1028:0c5e, NOT the live grid.
  // On subsequent calls, remove the frame from the temporary and target grids.
  // Copy target to live ONLY on equality (JNZ at a2d0 skips the copy).
  if (state.levelId === 26 && empty(run(0x1377, 5))) {
    if (flags['4902'] !== 1) {
      flags['4902'] = 1;
      transition(state);
      erasePaddle(state, true);
      Object.assign(state.paddle, { y: 272, rightInset: 30, leftInset: 30 });
    } else {
      const temporary = [...state.cells];
      const frame = [...run(0x1366, 7), ...run(0x13a6, 7),
        ...run(0x1376, 3, 16), ...run(0x137c, 3, 16)];
      for (const index of frame) {
        temporary[index] = '0';
        state.targetCells[index] = '0';
      }
      if (temporary.every((cell, index) => cell === state.targetCells[index])) {
        for (let index = 0; index < 160; index++) state.cells[index] = state.targetCells[index];
      }
    }
  }
  return state;
}

/** 1000:1cfd: x is already clamped by the caller; width does not alter steps. */
export function updatePaddleHeight(input) {
  const state = prepareState(input);
  const { left, right } = state.bounds;
  const { x, y } = state.paddle;
  const flags = state.flags;
  let height = y;
  const outside = (fromLeft, fromRight) => x < left + fromLeft || x > right - fromRight;
  switch (state.levelId) {
    case 27:
      height = outside(120, 60) ? 301 : outside(150, 90) ? 271 :
        outside(180, 150) ? 241 : 211;
      break;
    case 25:
      if (flags['4900'] !== 1) height = outside(120, 150) ? 151 :
        outside(180, 210) ? 121 : 91;
      break;
    case 22:
      height = x === left || x === right - 30 ? 272 : outside(30, 60) ? 242 :
        outside(60, 90) ? 212 : outside(90, 120) ? 182 :
        outside(120, 150) ? 152 : outside(150, 180) ? 122 : 92;
      break;
    case 23:
      height = x > right - 90 ? 272 : x > right - 180 ? 242 :
        x > right - 270 ? 212 : 182;
      break;
    case 24:
      if (flags['48fe'] === 1) {
        if (x < left + 210) height = 272;
        else if (x < left + 270) height = 242;
        else if (x < left + 330) height = 212;
        else if (x < left + 390) height = 182;
        else if (x < left + 450) height = 152;
        // Native code has no final else; keep previous y beyond this threshold.
      }
      break;
  }
  state.paddle.previousY = y; // 1028:4858 is saved even if altitude is unchanged.
  if (height !== y) erasePaddle(state, false);
  state.paddle.y = height;
  return state;
}
