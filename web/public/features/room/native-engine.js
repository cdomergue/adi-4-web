import { runRoomScript } from './generated/original-room.js';

// State names and thresholds below follow EDIINTRO.TOT and CCONT.TOT.
// The browser supplies media completion; the original instructions supply order,
// branches, repeat counts, posture and concurrent object starts.
export function createNativeRoom({ random = Math.random, seconds = () => Date.now() / 1000 - new Date().getTimezoneOffset() * 60,
  emit = () => {}, texts = {}, available = () => true } = {}) {
  const v = new Proxy({}, { get: (o, k) => o[k] ?? 0 });
  const history = new Map(), stack = [];
  let actorPending = false, objectPending = false, voicePending = false, stopped = false;
  let mouth = null, activeActor = '', awaitingClick = false;
  let sleeping = false, wantsSpeech = false, lastClick = -Infinity, clickKind = 0;
  let pauseUntil = 0;
  const time = () => Math.floor(seconds());
  const renewTime = () => { const now = time(); v[9] = Math.floor(now / 3600); v[10] = Math.floor(now / 60) % 60; v[11] = now % 60; };
  const stringArrays = [0x1130,0x1108,0x1180,0x1158];
  const key = (base, indices) => [base, ...indices].join(':');
  const context = { v, stack, randomInt: n => Math.floor(random() * n), renewTime,
    array: (base, ...indices) => stringArrays.includes(base) ? v[base + indices[0] * 20] || '' : history.get(key(base, indices)) ?? 0,
    setArray: (base, indices, value) => {
      if (stringArrays.includes(base)) v[base + indices[0] * 20] = value;
      else history.set(key(base, indices), value);
    }, service,
    checkData: name => available(name.replace(/\.VMD$/, '')) ? 1 : -1,
    textItem: (item, part) => texts[item]?.[part] || '',
    printText: (text, x, y, font, color) => emit({type: 'text', text, x, y, font, color}),
    loadSprite: resource => emit({type: 'background', index: resource - 30000}),
  };
  const run = (script, address) => runRoomScript(script, address, context);
  const clock = address => { v[address] = time(); };
  Object.assign(v, { 0x2db: 70, 0x274: 0, 0x14d: 3, 0x141: 3, 0x293: -1, 0x295: -1,
    0x16b: -1, 0x1a7: -1, 0x14b: -1, 0x151: 1, 0x2dd: 1,
    0x2de: -1000, 0x2df: -1000, 0x2e0: -1000, 0x2e3: 1, 0x255: -1,
    0xe88: '', 0xeb0: '', 0xeec: '', 0x102c: '' });
  run('EDIINTRO', 0x1843);
  for (const address of [0x2cb, 0x2ce, 0x2d1, 0x2d3]) clock(address);

  function service(script, address) {
    if (script === 'EDIINTRO') {
      if (address === 0x0209) { clock(0x2cb); v[0x2b3] = 0; return; }
      if (address === 0x022b || address === 0x0291) return; // release previous sound caches
    }
    if (script !== 'CCONT') throw new Error(`Unmapped native service ${script}:${address.toString(16)}`);
    if (address === 0x05bb) { run('LIBADI', 0x63b2); return; }
    if (address === 0x03c1) { run('LIBAPPEL', 0x1fd1); return; }
    if (address === 0xdc8a) { run('LANGUE', 0x80); return; }
    if ([0x063d,0x064e].includes(address)) return; // LIBAPPEL 1c47 and 1c4b are empty native functions.
    if (address === 0x049e) {
      // LIBAPPEL function 57 -> 294f -> interaction block 29c4.
      // This call blocks CCONT until input; it is not toolbar function 64.
      awaitingClick = true; emit({ type: 'awaitClick' }); return;
    }
    if (address === 0x0575) { emit({ type: 'closeToolbar' }); return; }
    if (address === 0x0583 || address === 0x0591) {
      sleeping = true; v[0xe88] = address === 0x0583 ? 'ADIDAI40' : 'ADIPZD62';
      v[0x2e0] = -2000; emit({ type: 'sleep', active: true }); return;
    }
    if (address === 0x0526) { run('LIBAPPEL', 0xa680); return; }
    if (address === 0x04f3) { run('LIBAPPEL', 0x916e); return; }
    if (address === 0x03d2) { run('LIBAPPEL', 0x4cbe); return; }
    if (address === 0x0449) { clock(0x2cb); v[0x2b3] = 0; return; }
    if (address === 0x0438) { clock(0x2d1); return; }
    if (address === 0x045a) { clock(0x2c6); return; }
    if (address === 0x0559) {
      v[0x2e3] = 21; 
      emit({ type: 'scene', view: v[0x20f], actorVisible: false });
      run('IMAGE', 0x80); return;
    }
    if (address === 0x0567) {
      v[0x2e3] = 1; 
      v[0x20f] = 0;
      emit({ type: 'scene', view: 0, actorVisible: true });
      run('IMAGE', 0x80); return;
    }
    if (address === 0x03a6) {
      if (v[0x20c] === 18) { emit({ type: 'hideActor' }); return; }
      if (v[0x20c] === 17 || v[0x20c] === 36 || v[0x20c] === 28) {
        emit({ type: 'pose', pose: v[0x14d] });  return;
      }
      if (v[0x20c] === 2) { run('LIBADI', 0x967e); return; }
      if (v[0x20c] === 62 || v[0x20c] === 63) {
        run('LIBADI', v[0x20c] === 62 ? 0x6be3 : 0x6b83); return;
      }
    }
    if (address === 0x03b0) { mouth = null; return; }
    if (address === 0x03e3) { mouth = { name: v[0xeec] + '.BCH', trajectory: v[0xe88] }; v[0x183] = 0; return; }
    if (address === 0x046b) return; // video caching, playback handled below
    if ([0x0405, 0x0416].includes(address)) return; // native clickable Adi bounds, updated by the view
    throw new Error(`Unmapped native service ${script}:${address.toString(16)} (${v[0x20c]})`);
  }
  function begin(group, index) {
    v[0x298] = group; v[0x253] = index;
    run('EDIINTRO', 0x59fd);
    emit({ type: 'begin', group, index, pose: v[0x14d] });
  }
  function select() {
    run('EDIINTRO', 0x5bd3);
    if (v[0x296] === 1) { begin(2, v[0x253]); return; }
    run('EDIINTRO', 0x5830);
    if (v[0x298] === 3) { begin(2, 2); return; }
    if (v[0x298] === 4) { begin(2, 3); return; }
    let index = context.randomInt(51);
    const tries = v[0x14d] === 10 ? 20 : [0, 6].includes(v[0x14d]) ? 10 : 5;
    for (let i = 0; i < tries; i++, index = (index + 1) % 51) {
      v[0x253] = index; run('EDIINTRO', 0x599b);
      // CCONT 9ac5 has no step 2 and two step-3 branches: quarantine the original deadlock.
      if (index === 46 || index === v[0x255] || context.array(0x3f8, 0, index, 2) !== 0) continue;
      v[0x1ab] = 0; run('EDIINTRO', 0x691a);
      if (v[0x1ab] === 1) { begin(0, index); return; }
    }
  }
  function postureFor(name) {
    if (name.startsWith('ADIPZD')) { v[0x2bd] = Number(name.slice(6)); run('LIBAPPEL', 0x43c2); }
    else if (name.startsWith('ADIPZA')) { v[0x2bd] = Number(name.slice(6)); run('LIBAPPEL', 0x4351); }
    else if (name.startsWith('ADIPZG')) { v[0x2bd] = Number(name.slice(6)); run('LIBAPPEL', 0x44d9); }
  }
  function afterActor(name) {
    if (name.startsWith('ADIDM')) v[0x14d] = name.charCodeAt(6) - 65;
    const continuations = { ADIPZA11: 2, ADIPZA13: 0, ADIPZD24: 2, ADIPZD27: 1,
      ADIPZD56: 3, ADIPZD26: 0, ADIPZD29: 0, ADIPZD58: 0, ADIPZG05: 1, ADIPZG07: 0 };
    if (name in continuations) v[0x150] = continuations[name];
    v[0x2dd] = 1; v[0x140] = 0; v[0x14f] = 0; v[0x14b] = -1;
  }
  function requests() {
    if (v[0x2de] === -2000 && !objectPending) {
      const name = v[0xeb0];
      if (!name || !available(name)) {
        v[0x2de] = -1000; emit({type: 'unavailable', name}); return;
      }
      objectPending = true; v[0x2de] = 1;
      emit({ type: 'object', name, muted: v[0x2df] === -2000 && name === v[0xeec] });
    }
    if (v[0x2df] === -2000 && !voicePending) {
      const name = v[0xeec]; voicePending = true; v[0x2df] = 1;
      emit({ type: 'voice', name, delayFrames: v[0x183], mouth }); mouth = null;
    }
    if (v[0x2e0] === -2000 && !actorPending) {
      const name = v[0xe88];
      if (!name) { v[0x2e0] = -1000; return; }
      postureFor(name); actorPending = true; activeActor = name; v[0x2e0] = 1;
      emit({ type: 'actor', name, pose: v[0x14d], tilt: v[0x150], step: Math.max(1, v[0x2dd]),
        repeats: sleeping ? Infinity : 1 + Math.max(0, v[0x139]) });
      v[0x139] = 0;
    }
  }
  function tick() {
    if (stopped || sleeping || awaitingClick) return;
    if (wantsSpeech && v[0x2e3] === 1 && [0, 3, 6, 10].includes(v[0x14d]) && !activeActor.startsWith('ADIDM')) {
      wantsSpeech = false; pauseUntil = 0;
      v[0x137] = v[0x298] === 2 && [4,5].includes(v[0x293]) ? 1 : 0;
      // EDIINTRO:0725 calls LIBADI 28 (e874/e7be) before choosing the reply.
      // Stop the current voice immediately, including a long story.
      actorPending = objectPending = voicePending = false; activeActor = ''; mouth = null;
      v[0x2e0] = v[0x2de] = v[0x2df] = -1000;
      v[0x150] = v[0x139] = v[0x136] = v[0x183] = 0;
      emit({ type: 'cancelTracks' });
      emit({ type: 'pose', pose: v[0x14d] });
      if (clickKind === 3 || v[0x137]) {
        v[0x1a8] = clickKind === 3 ? 3 : 4; begin(2, 9);
      } else begin(2, v[0x14d] === 3 ? 5 : 4);
    }
    if (actorPending || voicePending) return;
    if (pauseUntil) { if (seconds() < pauseUntil) return; pauseUntil = 0; v[0x136] = 0; }
    for (let step = 0; step < 1 && !actorPending; step++) {
      if (v[0x293] === -1) {
        if (objectPending) return;
        select(); if (v[0x293] === -1) return;
      }
      const previous = v[0x2c3], group = v[0x298];
      const entries = { 0: 0xac25, 1: 0xac8d, 2: 0xaf1b, 3: 0xaf86, 4: 0xc31e, 5: 0xbc8b, 9: 0xbbaa };
      run('CCONT', group === 0 ? 0x00ea : entries[v[0x293]]);
      if (v[0x136] > 0) pauseUntil = seconds() + v[0x136];
      requests();
      if (v[0x293] === -1) {
        if (group === 0) { clock(0x2cb); clock(0x2d3); v[0x2b3] = 0; }
        else if (v[0x253] === 3) clock(0x2ce);
        emit({ type: 'end', pose: v[0x14d] });
        return;
      }
      if (pauseUntil || previous === v[0x2c3]) return;
    }

  }
  return { v, tick,
    complete(type, name) {
      if (stopped) return;
      if (type === 'actor') { actorPending = false; activeActor = ''; v[0x2e0] = -1000; afterActor(name); }
      if (type === 'voice') { voicePending = false; v[0x2df] = -1000; }
      if (type === 'object') { objectPending = false; v[0x2de] = -1000; }
    },
    start(group, index, pose = v[0x14d]) {
      if (stopped) return;
      actorPending = objectPending = voicePending = awaitingClick = sleeping = false; pauseUntil = 0; activeActor = '';
      v[0x2e0] = v[0x2de] = v[0x2df] = -1000; v[0x14d] = pose;
      begin(group, index);
    },
    interact() {
      clock(0x2cb); clock(0x2d1); v[0x29d] = 0;
      if (awaitingClick) { awaitingClick = false; return true; }
      if (sleeping) {
        sleeping = false; actorPending = false; v[0x2e0] = -1000;
        emit({ type: 'wake' });
        return true;
      }
      return false;
    },
    speak() {
      clickKind = seconds() - lastClick < 0.75 ? 3 : 0;
      lastClick = seconds(); wantsSpeech = true;
    },
    stop() { stopped = true; },
  };
}
