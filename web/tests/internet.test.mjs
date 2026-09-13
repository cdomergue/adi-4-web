import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createLocalInternet, grade, gifts, storageKey, weekStart } from '../public/features/internet/engine.js';
import { addDays, calendarHour, canReserve, hourStart } from '../public/features/internet/calendar.js';
const base = new URL('../public/game/internet/', import.meta.url);
const json = async name => JSON.parse(await readFile(new URL(name, base), 'utf8'));
const catalog = await json('catalog.json'), lessons = await json('lessons.json');
const sample = lessons.find(l => l.id === 'FRF6AAA1');
const now = new Date(2026, 8, 12, 12).getTime();
function setup(store = new Map()) {
  const storage = { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value) };
  return { engine: createLocalInternet({ catalog, lessons, storage, now: () => now }), store };
}
test('Internet: original three planets and four-destination forum, without absent INTJEUX', () => {
  assert.deepEqual(catalog.menus.AI_MENU.map(r => r.rect), [[10,88,157,231],[442,36,185,196],[196,147,284,245]]);
  assert.equal(catalog.menus.AI_FORUM.length, 4);
  assert.equal(catalog.menus.AI_FORON.length, 5);
  assert.equal(catalog.sessions.length, 222);
});
test('Internet: exported native answers use the original bitmask, including multi-selection', () => {
  assert.equal(lessons.length, catalog.playableExercises);
  assert.equal(sample.questions.length, 3);
  assert.deepEqual(sample.questions.map(q => q.answerMask), [2,4,4]);
  assert.equal(sample.questions[1].prompt, 'Tu vas ⟦as⟧ la piscine tous les jeudis.');
  assert.equal(grade(sample.questions[1], [2]), true);
  assert.equal(grade(sample.questions[1], [1,2]), false);
  assert.equal(grade(sample.questions[0], [99]), false);
  assert.equal(grade({ choices:['a','b','c'], answerMask:5 }, [0,2]), true);
  for (const l of lessons) for (const q of l.questions) {
    assert.ok(q.prompt.length > 0 && q.choices.length > 1 && q.answerMask > 0 && q.answerMask < 2 ** q.choices.length);
    assert.equal(grade(q, q.choices.flatMap((_,i) => q.answerMask & 2 ** i ? [i] : [])), true);
  }
});
test('Internet: writing, chapters, votes and favorites survive a reload', () => {
  const {engine:e,store} = setup();
  assert.throws(() => e.request('writeItem', {category:'jokes',title:'',body:'hello'}), /titre/);
  const article = e.request('writeItem', { category:'novels', title:'La suite', body:'<img src="https://invalid.example/">' });
  e.request('writeChapter', {id:article.id,body:'Chapitre deux'});
  e.request('voteItem', {id:article.id,vote:3}); e.request('voteItem', {id:article.id,vote:1});
  e.request('favorite', {id:article.id});
  const loaded = setup(store).engine.state;
  assert.equal(loaded.articles.at(-1).chapters.length, 2);
  assert.equal(loaded.articles.at(-1).votes.Voyageur, 1);
  assert.ok(loaded.favorites.includes(article.id));
  assert.ok(store.has(storageKey));
});
test('Internet: friends and mail are local records, with a tagged demo response', () => {
  const {engine:e} = setup(); e.request('removeFriend', {id:'lina'});
  assert.throws(() => e.request('writeMail', {to:['lina'],title:'Test',body:'Bonjour'}), /destinataire/);
  e.request('addFriend', {id:'lina'});
  e.request('writeMail', {to:['lina','nino'],title:'Test',body:'Bonjour'});
  const s=e.state; assert.equal(s.messages.length, 3); assert.equal(s.messages.at(-1).demo, true);
  e.request('readMail', {id:s.messages.at(-1).id}); assert.equal(e.state.messages.at(-1).read,true);
  e.request('deleteMail',{id:s.messages.at(-1).id}); assert.equal(e.state.messages.length,2);
});
test('Internet: weekly controls affect publication, conversation and reservation', () => {
  const {engine:e} = setup();
  e.request('controls',{forum:'limited',forumMinutes:1,reservationLimit:1,restricted:true});
  e.request('forumTime',{seconds:60}); assert.equal(e.forumAllowed(),false);
  assert.throws(() => e.request('chat',{text:'Bonjour'}),/dépassé/);
  assert.throws(() => e.request('writeItem',{category:'jokes',title:'Test',body:'Test'}),/dépassé/);
  e.request('reserve',{session:'F6AA',date:now+86400000,seat:2});
  assert.throws(() => e.request('reserve',{session:'M6EA',date:now+86400000,seat:1}),/déjà réservé/);
  assert.throws(() => e.request('reserve',{session:'F6AA',date:now+86400000+3600000,seat:1}),/dépassé/);
});
test('Internet: reservation validates subscription, excluded hours, horizon and cancellation', () => {
  const {engine:e} = setup(); const params={session:'F6AA',date:now+86400000,seat:1};
  e.request('subscription',{enabled:false}); assert.throws(() => e.request('reserve',params),/abonnement/);
  e.request('subscription',{enabled:true});
  assert.throws(() => e.request('reserve',{...params,date:now+29*86400000}),/heure disponible/);
  const early = new Date(now+86400000);early.setHours(4);
  assert.throws(() => e.request('reserve',{...params,date:+early}),/heure disponible/);
  const r=e.request('reserve',params);e.request('cancelReservation',{id:r.id});assert.equal(e.state.reservations.length,0);
  assert.equal(weekStart(now),weekStart(now+86400000));
});
test('Internet: original exercise result yields bounded demo points, never repeated farming', () => {
  const {engine:e} = setup(); assert.throws(() => e.request('giveGoodie',{id:gifts[0].id}),/assez/);
  const result=e.request('finishExercise',{lesson:sample.id,answers:[[1],[2],[2]]});
  assert.equal(result.score,20);assert.equal(e.earned(),15);
  e.request('finishExercise',{lesson:sample.id,answers:[[1],[2],[2]]});assert.equal(e.earned(),15);
  e.request('giveGoodie',{id:gifts[0].id});assert.equal(e.balance(),10);
  e.request('giveGoodie',{id:gifts[0].id});assert.equal(e.balance(),10);
  assert.equal(setup(new Map([[storageKey,JSON.stringify(e.state)]])).engine.balance(),10);
});
test('Internet: changing a booking preserves its identity and respects the weekly quota', () => {
  const { engine: e, store } = setup();
  e.request('controls', { forum: 'unlimited', forumMinutes: 60, reservationLimit: 1, restricted: true });
  const original = e.request('reserve', { session: 'F6AA', date: now + 86400000, seat: 2 });
  e.request('reserve', { ...original, session: 'M6EA', seat: 6 });
  const saved = setup(store).engine.state.reservations;
  assert.equal(saved.length, 1);
  assert.deepEqual(saved[0], { ...original, session: 'M6EA', seat: 6 });
  const snapshot = e.state.reservations;
  assert.throws(() => e.request('reserve', { ...original, seat: 7 }), /place/);
  assert.throws(() => e.request('reserve', { ...original, id: 'missing' }), /n’existe plus/);
  assert.deepEqual(e.state.reservations, snapshot);
});
test('Internet: hourly bookings reject minute offsets and preserve old saves on collision', () => {
  const { engine: e, store } = setup();
  const params = { session: 'F6AA', date: now + 86400000, seat: 1 };
  assert.throws(() => e.request('reserve', { ...params, date: params.date + 60000 }), /heure disponible/);
  const original = e.request('reserve', params);
  const old = e.state;
  old.reservations[0].date += 15 * 60000; // The previous datetime input allowed minutes.
  store.set(storageKey, JSON.stringify(old));
  const reloaded = setup(store).engine;
  assert.throws(() => reloaded.request('reserve', { ...params, session: 'M6EA' }), /déjà réservé/);
  assert.equal(reloaded.state.reservations[0].date, old.reservations[0].date);
  reloaded.request('reserve', { ...params, id: original.id, seat: 3 });
  assert.equal(reloaded.state.reservations[0].date, params.date);
  reloaded.request('cancelReservation', { id: original.id });
  assert.equal(setup(store).engine.state.reservations.length, 0);
});
test('Internet: calendar uses civil days and permits the current hourly slot', () => {
  assert.equal(canReserve(hourStart(now), now + 30 * 60000), true);
  assert.equal(canReserve(hourStart(now) - 3600000, now), false);
  assert.equal(canReserve(null, now), false);
  const oldTimezone = process.env.TZ;
  process.env.TZ = 'Europe/Paris';
  try {
    for (const [month, day, duration] of [[2, 29, 23], [9, 25, 25]]) {
      const start = new Date(2026, month, day).getTime();
      assert.equal((addDays(start, 1) - start) / 3600000, duration);
      assert.equal(new Date(addDays(start, 1)).getHours(), 0);
      assert.equal(new Date(calendarHour(start, 14)).getHours(), 14);
    }
    assert.equal(calendarHour(new Date(2026, 2, 29).getTime(), 2), null);
  } finally {
    if (oldTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = oldTimezone;
  }
});
test('Internet: read and deleted mail persist without recreating the welcome message', () => {
  const { engine: e, store } = setup();
  e.request('readMail', { id: 'welcome' });
  assert.equal(setup(store).engine.state.messages[0].read, true);
  e.request('deleteMail', { id: 'welcome' });
  assert.equal(setup(store).engine.state.messages.length, 0);
  const sent = e.request('writeMail', { to: ['lina'], title: 'é'.repeat(50), body: 'Bonjour' });
  assert.equal(sent.title.length, 39);
});
test('Internet: storage failure is reported without losing the current play session', () => {
  const e=createLocalInternet({catalog,lessons,storage:{getItem(){throw Error('blocked')},setItem(){throw Error('full')}}});
  e.request('connect');assert.equal(e.storageError,true);assert.equal(e.state.connected,true);
});
test('Internet: media exports match original provenance manifests and menu animation lists', async () => {
  const manifest=await json('manifest.json');
  for(const f of manifest.files) {
    const bytes=await readFile(new URL(f.file,base));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256,f.file);
  }
  const ambient=await json('ambient.json'), media=await json('media.json');
  assert.equal(ambient.initialDelay,8);assert.equal(ambient.pauseMin,4);assert.equal(ambient.pauseChoices,3);
  for(const name of Object.values(ambient.groups).flat())assert.ok(media[name]?.image,name);
  for(const clip of Object.values(media))for(const f of [clip.image,clip.audio])if(f)await access(new URL(f,base));
});
test('Internet: independent CSP blocks external resources and real form submission', async () => {
  const html=await readFile(new URL('../public/internet.html',import.meta.url),'utf8');
  assert.match(html,/default-src 'none'/);assert.match(html,/connect-src 'self'/);assert.match(html,/form-action 'none'/);
  const player=await readFile(new URL('../public/features/internet/player.js',import.meta.url),'utf8');
  assert.equal((player.match(/\bfetch\(/g)||[]).length,1);
  assert.match(player,/fetch\(asset\(f\)\)/);
  assert.doesNotMatch(player, /\b(?:WebSocket|XMLHttpRequest|EventSource|sendBeacon|window\.open)\b/);
  assert.doesNotMatch(player, /(?:href|src)="\$\{[^}]*address/);
  assert.doesNotMatch(player, /Envoyer[^']*localement/);
});
test('Internet: transparent UI sprites retain verified original provenance', async () => {
  const manifest = await json('ui-manifest.json');
  const originals = await json('manifest.json');
  assert.equal(manifest.length, 7);
  for (const item of manifest) {
    const source = originals.files.find(f => f.file === item.source);
    assert.equal(item.sourceSha256, source.sha256);
    for (const [file, hash] of [[item.file, item.sha256], [item.source, item.sourceSha256]]) {
      assert.equal(createHash('sha256').update(await readFile(new URL(file, base))).digest('hex'), hash, file);
    }
  }
});
