import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createNativeRoom } from '../public/features/room/native-engine.js';
import { runRoomScript } from '../public/features/room/generated/original-room.js';

const base = new URL('../public/game/room/native/', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('catalog.json', base)));
const texts = JSON.parse(await readFile(new URL('texts.json', base)));
function rng(seed) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
function eligibility(index) {
  const v = { 0x253: index };
  for (const bored of [0, 1]) for (const pose of [3, 0, 6, 10]) {
    v[0x29d] = bored; v[0x14d] = pose; v[0x1ab] = 0;
    runRoomScript('EDIINTRO', 0x691a, { v });
    if (v[0x1ab]) return { pose, bored };
  }
  return null;
}
function harness(seed = 12345) {
  let now = 40000, pending = [], ended = false;
  const events = [];
  const engine = createNativeRoom({ texts, seconds: () => now, random: rng(seed),
    available: name => !!catalog.clips[name],
    emit(event) {
      events.push(event);
      if (event.type === 'cancelTracks') pending = [];
      if (event.type === 'awaitClick') pending.push({ type: 'input', at: now + 20 });
      if (event.type === 'end') ended = true;
      if (!['actor', 'object', 'voice'].includes(event.type)) return;
      const clip = catalog.clips[event.name];
      assert.ok(clip, `Missing original clip ${event.name}`);
      const duration = Math.max(clip.frames / clip.fps / (event.step || 1), clip.audioDuration / 1000);
      pending.push({ ...event, at: now + (event.repeats === Infinity ? 20 : duration * (event.repeats || 1)) + (event.delayFrames || 0) / 12 });
    },
  });
  return { engine, events,
    get ended() { return ended; },
    advance(seconds, stopAtEnd = false) {
      const end = now + seconds;
      while (now < end && !(stopAtEnd && ended)) {
        engine.tick(); now += 1 / 12;
        pending = pending.filter(e => {
          if (e.at > now) return true;
          if (e.repeats === Infinity || e.type === 'input') engine.interact(); else engine.complete(e.type, e.name);
          return false;
        });
      }
    },
    runToEnd() {
      for (let i = 0; i < 1800 && !ended; i++) this.advance(1, true);
      assert.ok(ended, `Native scenario stuck at step ${engine.v[0x2c3]}`);
    },
  };
}

test('native eligibility depends on posture and inactivity, and excludes disabled scripts', () => {
  assert.deepEqual(eligibility(39), { pose: 10, bored: 0 });
  assert.deepEqual(eligibility(41), { pose: 6, bored: 0 });
  assert.deepEqual(eligibility(42), { pose: 3, bored: 0 });
  assert.equal(eligibility(49), null);
  assert.equal(eligibility(50), null);
});

test('all playable CCONT scenarios complete with original media, multiple random branches and wake-up clicks', () => {
  for (let index = 0; index < 49; index++) {
    // Original CCONT:9ac5 repeats case 3 and omits 2. The scheduler quarantines it.
    if (index === 46) continue;
    for (const seed of [1, 4, 12345, 90001]) {
      const s = harness(seed), { pose, bored } = eligibility(index);
      s.engine.start(0, index, pose); s.engine.v[0x29d] = bored;
      s.runToEnd();
    }
  }
});

test('fencing approaches from G, waits for the object, speaks, and finishes seated in X', () => {
  const s = harness(); s.engine.start(0, 41, 6); s.runToEnd();
  const names = s.events.filter(e => e.name).map(e => e.name);
  assert.deepEqual(names, ['ADIPZG05','XJEUXG','ADIDMGD0','ADIPZD04','IN5110D','ADIPZD01','IN5111D','ADIPZD08','ADIPZD09','IN5112X']);
  assert.equal(s.engine.v[0x14d], 10);
  const objectAt = s.events.findIndex(e => e.name === 'XJEUXG');
  assert.ok(s.events.slice(0, objectAt).some(e => e.type === 'scene' && !e.actorVisible));
});

test('clicking Adi selects jokes while standing D and long stories in A/G/X', () => {
  for (const pose of [0, 3, 6, 10]) {
    const s = harness(6); s.engine.v[0x14d] = pose;
    s.engine.speak(); s.runToEnd();
    assert.equal(s.events.find(e => e.type === 'begin').index, pose === 3 ? 5 : 4);
    assert.ok(s.events.some(e => e.name && catalog.clips[e.name].audio));
  }
});

test('automatic playback never selects a click-only joke or the broken original CD scenario', () => {
  const s = harness(892); s.advance(3600);
  const starts = s.events.filter(e => e.type === 'begin');
  assert.ok(starts.length > 40);
  assert.ok(starts.some(e => e.group === 0));
  assert.ok(starts.some(e => e.group === 2 && e.index === 0));
  assert.ok(starts.every(e => e.group === 0 ? e.index !== 46 : ![4,5,9].includes(e.index)));
  s.engine.stop(); const length = s.events.length; s.advance(100);
  assert.equal(s.events.length, length);
});

test('absence message waits for input, then runs its original return sequence', () => {
  const s = harness(); s.engine.start(0, 1, 6);
  for (let i = 0; i < 300 && !s.events.some(e => e.type === 'awaitClick'); i++) s.advance(0.1);
  assert.ok(s.events.some(e => e.type === 'awaitClick'));
  const step = s.engine.v[0x2c3];
  s.advance(5); assert.equal(s.engine.v[0x2c3], step);
  assert.equal(s.engine.interact(), true);
  s.runToEnd();
  assert.ok(s.events.some(e => e.name === 'IN0102D'));
});

test('a second click interrupts an ongoing story without waiting for its audio to finish', () => {
  const s = harness(6); s.engine.v[0x14d] = 0; s.engine.speak();
  s.advance(2);
  const before = s.events.length;
  s.engine.speak(); s.engine.tick();
  const events = s.events.slice(before);
  assert.ok(events.some(e => e.type === 'cancelTracks'));
  assert.ok(events.some(e => e.type === 'begin' && e.group === 2 && e.index === 9));
  assert.equal(s.engine.v[0x1a8], 4);
});

test('commode speech uses its original animated mouth and walking trajectory', async () => {
  const s = harness(); s.engine.start(0, 39, 10); s.runToEnd();
  const speech = s.events.find(e => e.type === 'voice' && e.name === 'IN5132');
  assert.deepEqual(speech.mouth, { name: 'IN5132.BCH', trajectory: 'ADIDMDA0' });
  const trajectories = JSON.parse(await readFile(new URL('trajectories.json', base)));
  assert.ok(trajectories.ADIDMDA0.length > 1);
  assert.ok(catalog.clips['IN5132.BCH'].frames > 1);
  for (const pose of [0,3,6,10]) assert.ok((await readFile(new URL(`pose-${pose}.webp`, base))).length > 0);
});

test('native room atlas pages and original lossless audio are complete and match their hashes', async () => {
  assert.deepEqual(catalog.missing, []);
  for (const [name, clip] of Object.entries(catalog.clips)) {
    assert.ok(clip.fps > 0 && clip.frames > 0, name);
    assert.equal(clip.frameMap.length, clip.width ? clip.frames : 0, name);
    for (const [file, hash] of Object.entries(clip.exports)) {
      assert.equal(createHash('sha256').update(await readFile(new URL(file, base))).digest('hex'), hash, file);
    }
  }
});
