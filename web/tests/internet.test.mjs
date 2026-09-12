import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createLocalInternet, grade, gifts, storageKey, weekStart } from '../public/features/internet/engine.js';
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
