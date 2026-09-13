import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createGame, castRay, step, shoot, use, collect, chooseWeapon, saveGame, loadGame, solid, episodeSaveKey, SAVE_KEY } from '../public/features/games/badtoys/engine.js';
const base = new URL('../public/game/badtoys/', import.meta.url);
const catalog = JSON.parse(readFileSync(new URL('catalog.json', base)));
const maps = JSON.parse(readFileSync(new URL('maps.json', base)));
function empty() {
  const map = { width: 64, height: 64, flags: Array(4096).fill(0), textures: Array(16384).fill(5),
    actors: [{x:3.5,y:3.5,angle:270}], scenery: [], doors: [], links: [], initial: Array(44).fill(0) };
  const game = createGame(map, catalog);
  game.player.owned = [true,true,true,true]; game.player.ammo = [99,10,10,50];
  return game;
}
test('episodes share five introductory maps and diverge using native episode operands', () => {
  assert.deepEqual(catalog.episodes['1'].maps, [19,18,17,1,2,3,7,11,15,32]);
  assert.deepEqual(catalog.episodes['2'].maps, [19,18,17,1,2,4,9,12,35,33]);
  assert.equal(catalog.episodes['2'].changedBytes.length, 10);
  for (const entry of Object.values(catalog.episodes)) for (const id of entry.maps) {
    const map = maps[id], game = createGame(map, catalog);
    assert.equal(map.flags.length, 4096); assert.equal(map.textures.length, 16384);
    assert.equal(game.player.health, 99); assert.equal(game.player.lives, 3);
    assert.equal(solid(game, game.player.x, game.player.y), false);
    assert.ok(map.flags.some((flag) => (flag & 255) === 111));
    for (const actor of map.actors) assert.ok(catalog.enemyTypes[actor.type]);
    for (const obj of map.scenery) assert.ok(catalog.images[`VEC_${obj.type}`]);
  }
  for (const {file} of Object.values(catalog.images)) assert.ok(existsSync(new URL(file,base)));
  for (const file of Object.values(catalog.sounds)) assert.equal(readFileSync(new URL(file,base)).subarray(0,4).toString(),'RIFF');
});
test('walls stop movement and shots; enemies can be defeated with original weapon damage', () => {
  const g = empty(); g.flags[3*64+4] = 0xa000;
  g.actors.push({x:5.5,y:3.5,type:0,health:4,dead:false,phaseTime:0,cooldown:100});
  assert.equal(castRay(g,3.5,3.5,1,0).distance,.5);
  for(let i=0;i<100;i++) step(g,{forward:1},.05);
  assert.ok(g.player.x < 4);
  chooseWeapon(g,1); shoot(g); assert.equal(g.actors[0].health,4); assert.equal(g.player.ammo[1],9);
  g.flags[3*64+4]=0;g.shot=0;shoot(g);assert.equal(g.actors[0].dead,true);assert.equal(g.kills,1);
});
test('locked door requires the correct key; opening is gradual and exit ends the level', () => {
  const g=empty();g.flags[3*64+4]=0xa800;g.doors.push({x:4,y:3,type:1,open:0,target:0,hold:0});
  use(g);assert.equal(g.doors[0].target,0);
  const k={x:3.5,y:3.5,type:48};assert.equal(collect(g,k),true);use(g);assert.equal(g.doors[0].target,1);
  step(g,{},.05);assert.ok(g.doors[0].open>0&&g.doors[0].open<1);
  for(let i=0;i<30;i++)step(g,{},.05);assert.equal(solid(g,4,3),false);
  g.doors=[];g.flags[3*64+4]=0xa66f;use(g);assert.equal(g.status,'won');
});
test('pickups respect native caps, combat can kill player, saves round-trip without resetting world', () => {
  const g=empty();g.player.health=95;collect(g,{x:3.5,y:3.5,type:43});assert.equal(g.player.health,99);
  g.player.health=1;g.actors.push({x:4.1,y:3.5,type:0,health:4,dead:false,phaseTime:0,cooldown:0});
  step(g,{},.05);assert.equal(g.status,'dead');assert.equal(g.player.health,0);
  const native=createGame(maps[19],catalog);native.player.ammo[1]=7;native.doors[0].open=.5;
  const restored=loadGame(saveGame(native,'1',0),maps,catalog);
  assert.equal(restored.game.player.ammo[1],7);assert.equal(restored.game.doors[0].open,.5);
  assert.equal(loadGame('{broken',maps,catalog),null);
  const corrupt=JSON.parse(saveGame(native,'1',0));corrupt.player.x=-1;assert.equal(loadGame(JSON.stringify(corrupt),maps,catalog),null);
});

test('energy projectiles travel, collide with walls and keep their state in saves', () => {
  const g = empty(); chooseWeapon(g, 3);
  g.actors.push({id:0,x:5.5,y:3.5,type:0,health:4,dead:false,phaseTime:0,cooldown:100});
  shoot(g); assert.equal(g.player.ammo[3],45); assert.equal(g.projectiles.length,1);
  assert.equal(g.actors[0].health,4);
  g.flags[3*64+4]=0xa000;
  for(let i=0;i<8;i++) step(g,{},.05);
  assert.equal(g.actors[0].health,4);
  g.flags[3*64+4]=0;g.shot=0;shoot(g);
  for(let i=0;i<8;i++) step(g,{},.05);
  assert.equal(g.actors[0].dead,true);
  const native = createGame(maps[19],catalog);
  native.player.owned[3]=true;native.player.ammo[3]=50;chooseWeapon(native,3);shoot(native);
  assert.deepEqual(loadGame(saveGame(native,'1',0),maps,catalog).game.projectiles,native.projectiles);
});
test('remote pressure plates open linked doors and corrupt saves are rejected', () => {
  const g=empty(); g.flags[3*64+4]=0xb000;g.doors.push({x:4,y:3,type:4,open:0,target:0,hold:0});
  use(g);assert.equal(g.doors[0].target,0);
  g.flags[3*64+3]=0x1001;g.map.links=[[1,3,4]];
  step(g,{},.05);assert.equal(g.doors[0].target,1);
  const original=JSON.parse(saveGame(createGame(maps[19],catalog),'1',0));
  for(const change of [s=>s.player.ammo[0]=-1,s=>s.actors[0]=null,s=>s.doors[0].open=8,s=>s.flags[0]='bad']){
    const s=structuredClone(original);change(s);assert.equal(loadGame(JSON.stringify(s),maps,catalog),null);
  }
});

test('all four episodes have a route to every exit after collecting keys and activating linked commands', () => {
  // Geometry audit, independent of enemy combat and simulation timing.
  for (const id of new Set(Object.values(catalog.episodes).flatMap((e) => e.maps))) {
    const map=maps[id], keys=new Set(), remote=new Set();
    const start=Math.floor(map.actors[0].y)*64+Math.floor(map.actors[0].x);
    let seen;
    for(let pass=0;pass<255;pass++) {
      const before = `${keys.size}/${remote.size}`;
      seen=new Set([start]);const queue=[start];
      for(let i=0;i<queue.length;i++) for(const t of [queue[i]-1,queue[i]+1,queue[i]-64,queue[i]+64]) {
        if(t<0||t>=4096||seen.has(t))continue;
        const door=map.doors.find(d=>d.y*64+d.x===t);
        if(door ? ((door.type>=1&&door.type<=3&&!keys.has(door.type-1))||([4,5].includes(door.type)&&!remote.has(t))) : map.flags[t]&0xa000)continue;
        seen.add(t);queue.push(t);
      }
      for(const object of map.scenery) if(seen.has(Math.floor(object.y)*64+Math.floor(object.x))&&object.type>=48&&object.type<=50) keys.add(object.type-48);
      // Defeating a reachable robot supplies its original yellow-key drop (MAP_16).
      for(const actor of map.actors.slice(1)) {
        const loot=catalog.enemyTypes[actor.type].loot;
        if(seen.has(Math.floor(actor.y)*64+Math.floor(actor.x))&&loot>=48&&loot<=50)keys.add(loot-48);
      }
      for(let t=0;t<4096;t++) if(map.flags[t]&0x1000&&(!(map.flags[t]&0x2000)?seen.has(t):[t-1,t+1,t-64,t+64].some(k=>seen.has(k)))) {
        const link=map.links[(map.flags[t]&255)-1];if(link?.[0]===1)remote.add(link[1]*64+link[2]);
      }
      if (before === `${keys.size}/${remote.size}`) break;
    }
    assert.ok(map.flags.some((f,t)=>(f&255)===111&&(f&0x2000)&&[t-1,t+1,t-64,t+64].some(k=>seen.has(k))),`MAP_${id}: unreachable exit`);
  }
});
test('native sound triggers use the first link operand', () => {
  const g=empty();g.flags[3*64+3]=0x1001;g.map.links=[[2,32,0]];
  step(g,{},.05);assert.ok(g.events.some(e=>e.type==='sound'&&e.id===32));
  assert.equal(g.flags[3*64+3]&0x1000,0);
});


test('each episode saves its own campaign and preserves the existing episode I slot', () => {
  assert.equal(episodeSaveKey('1'), SAVE_KEY);
  assert.equal(new Set([1,2,3,4].map(episodeSaveKey)).size, 4);
  const slots = new Map();
  for (const episode of ['1','2','3','4']) {
    assert.ok(catalog.images[`BM_BT${episode}`]);
    for (const [level, id] of catalog.episodes[episode].maps.entries()) {
      const game = createGame(maps[id], catalog);
      game.player.ammo[1] = 5 + Number(episode);
      const raw = saveGame(game, episode, level);
      const restored = loadGame(raw, maps, catalog);
      assert.equal(restored.episode, episode);
      assert.equal(restored.level, level);
      assert.equal(restored.game.map, maps[id]);
      slots.set(episodeSaveKey(episode), raw);
    }
  }
  for (const episode of ['1','2','3','4']) {
    const saved = loadGame(slots.get(episodeSaveKey(episode)), maps, catalog);
    assert.equal(saved.episode, episode);
    assert.equal(saved.game.player.ammo[1], 5 + Number(episode));
  }
});


test('defeating the episode IV robot drops the required key, including after a save', () => {
  const g=createGame(maps[16],catalog);
  const robot=g.actors.find(a=>a.type===4);
  assert.equal(catalog.enemyTypes[robot.type].loot,50);
  robot.health=0;robot.dead=true;robot.phase=3;robot.phaseTime=10;
  // Keep combat inactive while checking the death and loot lifecycle.
  for(const a of g.actors) a.cooldown=100;
  step(g,{},.05);
  const loot=g.scenery.find(s=>s.dropFrom===robot.id);
  assert.equal(loot.type,50);
  assert.equal(loadGame(saveGame(g,'4',9),maps,catalog).game.scenery.at(-1).type,50);
  step(g,{},.05);
  assert.equal(g.scenery.filter(s=>s.dropFrom===robot.id).length,1);
  collect(g,loot);assert.equal(g.player.keys[2],true);
  const restored=loadGame(saveGame(g,'4',9),maps,catalog);
  assert.equal(restored.game.player.keys[2],true);
  assert.equal(restored.game.scenery.at(-1).removed,true);
});

test('smiley spots player with SND_60 once, never through a wall or after restoring alert state', () => {
  assert.deepEqual(catalog.enemyTypes.slice(0,6).map(a=>a.alertSound),[60,70,0,85,100,90]);
  const g=empty();g.actors.push({id:0,x:6.5,y:3.5,type:0,health:4,phase:0,phaseTime:0,cooldown:100,alert:false});
  g.flags[3*64+4]=0xa000;step(g,{},.05);
  assert.ok(!g.events.some(e=>e.id===60));
  g.flags[3*64+4]=0;step(g,{},.05);
  assert.equal(g.events.filter(e=>e.id===60).length,1);
  for(let i=0;i<5;i++) step(g,{},.05);
  assert.equal(g.events.filter(e=>e.id===60).length,1);
  const native=createGame(maps[19],catalog),a=native.actors.find(a=>a.type===0);
  native.player.x=a.x+1;native.player.y=a.y;a.alert=true;
  const saved=loadGame(saveGame(native,'1',0),maps,catalog).game;
  for(const other of saved.actors)other.alert=true;
  step(saved,{},.05);assert.ok(!saved.events.some(e=>e.id===60));
});
test('animation cues include delayed enemy shots, footsteps and both smiley death sounds', () => {
  const g=empty();g.actors.push({id:0,x:6.5,y:3.5,type:1,health:10,phase:0,phaseTime:0,cooldown:0,alert:false});
  step(g,{},.05);assert.equal(g.player.health,99);assert.ok(!g.events.some(e=>e.id===1));
  for(let i=0;i<6;i++)step(g,{},.05);
  assert.equal(g.player.health,95);assert.equal(g.events.filter(e=>e.id===1).length,1);
  const robot=empty();robot.actors.push({id:0,x:13.5,y:3.5,type:4,health:750,phase:0,phaseTime:0,cooldown:100,alert:false});
  for(let i=0;i<12;i++)step(robot,{},.05);
  assert.equal(robot.events.filter(e=>e.id===102).length,2);
  const death=empty();death.actors.push({id:0,x:5.5,y:3.5,type:0,health:4,phase:0,phaseTime:0,cooldown:100,alert:false});
  chooseWeapon(death,1);shoot(death);
  assert.equal(death.events.filter(e=>e.id===64).length,1);assert.ok(!death.events.some(e=>e.id===65));
  for(let i=0;i<40;i++)step(death,{},.05);
  assert.equal(death.events.filter(e=>e.id===65).length,1);assert.equal(death.events.filter(e=>e.id===64).length,1);
});
test('projectile explosion cues use the death sequence and survive save/load mid-animation', () => {
  const g=empty();g.flags[3*64+4]=0xa000;chooseWeapon(g,3);shoot(g);
  for(let i=0;i<12;i++)step(g,{},.05);
  assert.equal(g.events.filter(e=>e.id===106).length,1);
  const saved=createGame(maps[19],catalog);
  saved.projectiles=[{x:45.5,y:29.5,type:7,owner:'player',angle:0,age:1,phase:3,phaseTime:.1,dead:true}];
  const loaded=loadGame(saveGame(saved,'1',0),maps,catalog).game;
  step(loaded,{},.05);assert.equal(loaded.events.filter(e=>e.id===106).length,1);
  loaded.events=[];const resumed=loadGame(saveGame(loaded,'1',0),maps,catalog).game;
  step(resumed,{},.05);assert.ok(!resumed.events.some(e=>e.id===106));
});
test('sound references are bundled; door closure and ambient sounds are triggered once', () => {
  for(const a of catalog.enemyTypes) for(const id of [a.alertSound,...a.phases.flatMap(s=>s.map(f=>f.sound))]) {
    if(id) assert.ok(catalog.sounds[`SND_${id}`],`${a.prefix}: missing SND_${id}`);
  }
  const g=empty();g.doors.push({x:20,y:20,type:0,open:.02,target:0,hold:0});
  step(g,{},.05);step(g,{},.05);assert.equal(g.events.filter(e=>e.id===23).length,1);
  g.events=[];g.ambientRemaining=.01;step(g,{},.05);
  assert.equal(g.events.length,1);assert.ok(g.events[0].id>=30&&g.events[0].id<=41);
  assert.ok(g.ambientRemaining>=550*.066&&g.ambientRemaining<850*.066);
});
