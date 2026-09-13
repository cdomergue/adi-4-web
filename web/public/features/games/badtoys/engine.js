// Shared Bad Toys simulation. Native data: maps, entity definitions and weapon tables.
export const SAVE_KEY = 'adi4-badtoys-v1';
export function episodeSaveKey(episode) {
  // Preserve the existing episode I save; later episodes have independent slots.
  return String(episode) === '1' ? SAVE_KEY : `${SAVE_KEY}-episode-${episode}`;
}
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const key = (x, y) => Math.floor(y) * 64 + Math.floor(x);
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export function createGame(map, catalog) {
  const initial = map.initial;
  const ammo = [0, 1, 2, 3].map((i) => initial[i * 6 + 1] + initial[i * 6 + 2] * 256);
  const owned = [0, 1, 2, 3].map((i) => Boolean(initial[i * 6]));
  const start = map.actors[0];
  return { map, catalog, flags: [...map.flags],
    player: { x: start.x, y: start.y, angle: (start.angle + 90) * Math.PI / 180,
      health: initial[40] || 99, lives: initial[42] || 3, ammo, owned,
      weapon: initial[36], keys: initial.slice(37, 40).map(Boolean) },
    actors: map.actors.slice(1).map((a, id) => ({ ...a, id,
      health: a.health || catalog.enemyTypes[a.type]?.health || 1,
      cooldown: 1 + id % 3 * .15, phase: 0, phaseTime: 0, dead: false, alert: false })),
    scenery: map.scenery.map((s) => ({ ...s, removed: false })),
    doors: map.doors.map((d) => ({ ...d, open: 0, target: 0, hold: 0 })),
    randomState: 0xad140001, ambientRemaining: 550 * .066, projectiles: [], time: 0, shot: 0, shotDuration: 0, hit: 0, kills: 0, events: [], status: 'playing' };
}
export function cell(game, x, y) {
  if (x < 0 || y < 0 || x >= 64 || y >= 64) return 0xa000;
  return game.flags[key(x, y)];
}
export function doorAt(game, x, y) {
  return game.doors.find((d) => d.x === Math.floor(x) && d.y === Math.floor(y));
}
export function solid(game, x, y) {
  const flag = cell(game, x, y);
  if (flag & 0x2000) return (doorAt(game, x, y)?.open ?? 0) < .85;
  return Boolean(flag & 0x8000);
}
export function castRay(game, x, y, dx, dy, maxDistance = 64) {
  let mx = Math.floor(x), my = Math.floor(y), side = 0, distance = 0;
  const sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1;
  const deltaX = Math.abs(1 / dx), deltaY = Math.abs(1 / dy);
  let nextX = (dx < 0 ? x - mx : mx + 1 - x) * deltaX;
  let nextY = (dy < 0 ? y - my : my + 1 - y) * deltaY;
  for (let step = 0; step < 160 && distance < maxDistance; step++) {
    if (nextX < nextY) { distance = nextX; nextX += deltaX; mx += sx; side = 0; }
    else { distance = nextY; nextY += deltaY; my += sy; side = 1; }
    const flag = cell(game, mx, my);
    if (!(flag & 0x2000)) continue;
    const door = doorAt(game, mx, my);
    if (door) {
      // The native shutters run through the centre of a cell and slide along it.
      const t = side === 0 ? (mx + .5 - x) / dx : (my + .5 - y) / dy;
      const along = side === 0 ? y + t * dy - my : x + t * dx - mx;
      if (along < 0 || along >= 1 || along < door.open) continue;
      distance = t;
    }
    let u = side === 0 ? y + distance * dy : x + distance * dx;
    u -= Math.floor(u);
    if (door) u -= door.open;
    if ((side === 0 && dx > 0) || (side === 1 && dy < 0)) u = 1 - u;
    const tile = key(mx, my);
    const face = side === 0 ? (dx > 0 ? 0 : 1) : (dy > 0 ? 2 : 3);
    const texture = game.map.textures[tile * 4 + (door ? side : face)] || 5;
    return { distance: Math.max(.01, distance), texture, u, x: mx, y: my, side, door };
  }
  return { distance: maxDistance, texture: 5, u: 0, x: mx, y: my, side };
}
function visible(game, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy);
  return castRay(game, a.x, a.y, dx / dist, dy / dist, dist).distance >= dist - .15;
}
function move(game, actor, dx, dy, enemies = false) {
  const radius = .19;
  const free = (x, y) => {
    for (const ox of [-radius, radius]) for (const oy of [-radius, radius]) {
      if (solid(game, x + ox, y + oy)) return false;
    }
    return !game.actors.some((other) => other !== actor && !other.dead && other.type < 6 &&
      Math.hypot(other.x - x, other.y - y) < .36) &&
      (!enemies || Math.hypot(game.player.x - x, game.player.y - y) > .55);
  };
  if (free(actor.x + dx, actor.y)) actor.x += dx;
  if (free(actor.x, actor.y + dy)) actor.y += dy;
}
function sound(game, id, source = null, volume = 1) {
  if (!id) return;
  // Positional attenuation is adapted; the original also attenuates distant actors.
  if (source) volume *= 1 / (1 + Math.hypot(source.x - game.player.x, source.y - game.player.y) / 4);
  game.events.push({ type: 'sound', id, volume });
}
function random(game, count) {
  game.randomState = (Math.imul(game.randomState, 1664525) + 1013904223) >>> 0;
  return Math.floor(game.randomState / 0x100000000 * count);
}
const animationRate = (actor) => actor.dead ? 7 : 8;
function framesFor(game, actor) {
  return game.catalog.enemyTypes[actor.type]?.phases[actor.phase] || [];
}
function setPhase(game, actor, phase, restart = false) {
  if (actor.phase === phase && !restart) return;
  actor.phase = phase; actor.phaseTime = 0;
  animationFrame(game, actor, 0);
}
function advanceAnimation(game, actor, dt) {
  const frames = framesFor(game, actor), rate = animationRate(actor);
  const previous = Math.floor(actor.phaseTime * rate);
  actor.phaseTime += dt;
  if (!frames.length) return;
  const current = Math.floor(actor.phaseTime * rate);
  const end = actor.phase === 0 || (actor.type >= 6 && !actor.dead) ? current : Math.min(current, frames.length - 1);
  for (let i = previous + 1; i <= end; i++) animationFrame(game, actor, i % frames.length);
}
function animationFrame(game, actor, index) {
  sound(game, framesFor(game, actor)[index]?.sound, actor);
  if (actor.type >= 6 || actor.dead || actor.phase !== 1 ||
    index !== game.catalog.enemyTypes[actor.type].attackFrame) return;
  const p = game.player, distance = Math.hypot(p.x - actor.x, p.y - actor.y);
  if (distance > (actor.type === 0 ? .9 : 6) || !visible(game, actor, p)) return;
  const attackKind = game.catalog.enemyTypes[actor.type].attackKind;
  if (attackKind >= 3) launchProjectile(game, actor, Math.atan2(p.y - actor.y, p.x - actor.x),
    {3: 7, 4: 6, 5: 8}[attackKind], actor.id);
  else hurtPlayer(game, [2, 4, 8, 5, 12, 5][actor.type]);
}
function detectPlayer(game, actor) {
  if (!actor.alert) {
    actor.alert = true;
    sound(game, game.catalog.enemyTypes[actor.type].alertSound, actor);
  }
}
function message(game, text) { game.events.push({ type: 'message', text }); }
export function chooseWeapon(game, index) {
  if (index >= 0 && index < 4 && game.player.owned[index] && game.shot <= 0) game.player.weapon = index;
}
export function shoot(game) {
  if (game.status !== 'playing' || game.shot > 0) return;
  const p = game.player, weapon = game.catalog.weapons[p.weapon];
  if (p.ammo[p.weapon] < weapon.cost) { message(game, 'Plus de munitions pour cette arme.'); return; }
  p.ammo[p.weapon] -= weapon.cost;
  game.shotDuration = game.shot = weapon.frames.length * .1;
  sound(game, weapon.sound);
  if (p.weapon === 3) { launchProjectile(game, p, p.angle, 7, 'player'); return; }
  const maxRange = p.weapon === 0 ? 1.35 : 30;
  const target = game.actors.filter((a) => !a.dead && a.type < 6 &&
    Math.hypot(a.x - p.x, a.y - p.y) < maxRange &&
    Math.abs(angleDiff(Math.atan2(a.y - p.y, a.x - p.x), p.angle)) <
      Math.atan2(.32, Math.hypot(a.x - p.x, a.y - p.y)) && visible(game, p, a))
    .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
  if (!target) { if (p.weapon > 0) sound(game, 4); return; }
  hurtActor(game, target, weapon.damage);
}
function hurtActor(game, target, damage) {
  if (target.dead) return;
  target.health -= damage;
  if (target.health > 0) detectPlayer(game, target);
  setPhase(game, target, target.health <= 0 ? 3 : 2, true);
  if (target.health <= 0) { target.dead = true; game.kills++; }
}
function dropLoot(game, actor) {
  const type = game.catalog.enemyTypes[actor.type].loot;
  actor.lootDropped = true;
  if (!type) return;
  const tile = key(actor.x, actor.y);
  const existing = game.scenery.find((s) => !s.removed && key(s.x, s.y) === tile);
  // The native death routine preserves keys already lying underneath an enemy.
  if (existing && [48, 49, 50].includes(existing.type)) return;
  if (existing) existing.removed = true;
  game.scenery.push({ x: Math.floor(actor.x) + .5, y: Math.floor(actor.y) + .5,
    type, removed: false, dropFrom: actor.id });
  game.flags[tile] = (game.flags[tile] & 0x7fff) | 0x800;
}
function hurtPlayer(game, damage) {
  if (damage > 14) sound(game, random(game, 10) < 6 ? 17 : 16);
  game.player.health = Math.max(0, game.player.health - damage); game.hit = .2;
  if (game.player.health === 0 && game.status === 'playing') {
    game.status = 'dead'; if (damage <= 14) sound(game, 17); message(game, 'Les jouets ont gagné cette manche.');
  }
}
function launchProjectile(game, source, angle, type, owner) {
  game.projectiles.push({ x: source.x, y: source.y, angle, type, owner,
    age: 0, phase: 1, phaseTime: 0, dead: false });
}
function updateProjectiles(game, dt) {
  for (const shot of game.projectiles) {
    shot.age += dt; advanceAnimation(game, shot, dt);
    if (shot.dead) continue;
    // Substeps prevent fast projectiles crossing a wall or actor between frames.
    const distance = dt * 6, count = Math.max(1, Math.ceil(distance / .1));
    for (let i = 0; i < count; i++) {
      const x = shot.x + Math.cos(shot.angle) * distance / count;
      const y = shot.y + Math.sin(shot.angle) * distance / count;
      const target = game.actors.find((a) => !a.dead && a.type < 6 && a.id !== shot.owner && Math.hypot(a.x - x, a.y - y) < .3);
      const playerHit = shot.owner !== 'player' && Math.hypot(game.player.x - x, game.player.y - y) < .25;
      if (solid(game, x, y) || target || playerHit) {
        const damage = game.catalog.enemyTypes[shot.type].projectileDamage;
        if (target) hurtActor(game, target, damage);
        if (playerHit) hurtPlayer(game, damage);
        shot.dead = true; setPhase(game, shot, 3, true);
        break;
      }
      shot.x = x; shot.y = y;
    }
  }
  game.projectiles = game.projectiles.filter((s) => s.age < 10 && (!s.dead || s.phaseTime < framesFor(game, s).length / 7));
}
function activateDoor(game, door, remote = false) {
  if (!remote && door.type >= 1 && door.type <= 3 && !game.player.keys[door.type - 1]) {
    sound(game, 29); message(game, 'Il te manque la clé de cette porte.'); return;
  }
  if (!remote && (door.type === 4 || door.type === 5)) { message(game, 'Cherche la commande de cette porte.'); return; }
  door.target = 1; door.hold = 4;
  sound(game, door.type >= 1 && door.type <= 3 ? 28 : door.type === 6 ? 26 : 25);
}
export function use(game) {
  if (game.status !== 'playing') return;
  const p = game.player;
  for (let distance = .2; distance < 1.7; distance += .1) {
    const x = Math.floor(p.x + Math.cos(p.angle) * distance);
    const y = Math.floor(p.y + Math.sin(p.angle) * distance);
    const flag = cell(game, x, y), index = key(x, y);
    if ((flag & 0xff) === 111 && (flag & 0x2000)) {
      game.status = 'won'; sound(game, 27); message(game, 'Niveau terminé !'); return;
    }
    const door = doorAt(game, x, y);
    if (door) { activateDoor(game, door); return; }
    if (flag & 0x1000) {
      const link = game.map.links[(flag & 255) - 1];
      if (link?.[0] === 1) {
        const target = doorAt(game, link[2], link[1]);
        if (target) activateDoor(game, target, true);
      } else if (link?.[0] === 2) sound(game, link[1]);
      game.flags[index] &= 0xef00;
      message(game, 'Commande activée.'); return;
    }
    if (flag & 0x2000) break;
  }
}
export function collect(game, object) {
  const p = game.player, t = object.type;
  let accepted = false, id = 13;
  const health = { 40: [5, 10], 41: [7, 15], 42: [5, 11], 43: [20, 14] }[t];
  if (health && p.health < 99) { p.health = Math.min(99, p.health + health[0]); accepted = true; id = health[1]; }
  if (t >= 48 && t <= 50 && !p.keys[t - 48]) { p.keys[t - 48] = true; accepted = true; id = 12; }
  if (t === 47 && p.lives < 9) { p.lives++; accepted = true; id = 37; }
  const ammo = { 46: [1, 5, 50], 45: [2, 5, 50], 44: [3, 10, 99], 51: [2, 5, 50], 52: [3, 10, 99] }[t];
  if (ammo && (p.ammo[ammo[0]] < ammo[2] || (t >= 51 && !p.owned[ammo[0]]))) {
    p.ammo[ammo[0]] = Math.min(ammo[2], p.ammo[ammo[0]] + ammo[1]);
    if (t >= 51) p.owned[ammo[0]] = true;
    if (p.weapon === 0 && p.owned[ammo[0]]) p.weapon = ammo[0];
    accepted = true;
  }
  if (accepted) { object.removed = true; game.flags[key(object.x, object.y)] &= 0x77ff; sound(game, id); }
  return accepted;
}
export function step(game, input, elapsed) {
  if (game.status !== 'playing') return;
  const dt = clamp(elapsed, 0, .05), p = game.player;
  game.ambientRemaining -= dt;
  if (game.ambientRemaining <= 0) {
    sound(game, 30 + random(game, 12), null, 180 / 254);
    game.ambientRemaining = (550 + random(game, 300)) * .066;
  }
  game.time += dt; game.shot = Math.max(0, game.shot - dt); game.hit = Math.max(0, game.hit - dt);
  p.angle += (input.turn || 0) * dt * 2.2;
  const speed = (input.run ? 4 : 2.5) * dt;
  const forward = input.forward || 0, strafe = input.strafe || 0;
  const norm = Math.max(1, Math.hypot(forward, strafe));
  move(game, p, (Math.cos(p.angle) * forward - Math.sin(p.angle) * strafe) * speed / norm,
    (Math.sin(p.angle) * forward + Math.cos(p.angle) * strafe) * speed / norm);
  if (input.fire) shoot(game);
  for (const door of game.doors) {
    if (door.target === 1 && door.open >= 1) {
      door.hold -= dt;
      if (door.hold <= 0 && Math.hypot(p.x - door.x - .5, p.y - door.y - .5) > 1.2 &&
        !game.actors.some((a) => !a.dead && Math.hypot(a.x - door.x - .5, a.y - door.y - .5) < 1)) door.target = 0;
    }
    const previousOpen = door.open;
    door.open = clamp(door.open + (door.target ? 1 : -1) * dt * .8, 0, 1);
    if (previousOpen > 0 && door.open === 0) sound(game, 23, door);
  }
  for (const object of game.scenery) if (!object.removed && Math.hypot(object.x - p.x, object.y - p.y) < .65) collect(game, object);
  const tile = key(p.x, p.y), flag = cell(game, p.x, p.y);
  if ((flag & 0x1000) && !(flag & 0x2000)) {
    const link = game.map.links[(flag & 255) - 1];
    if (link?.[0] === 1) { const door = doorAt(game, link[2], link[1]); if (door) activateDoor(game, door, true); }
    if (link?.[0] === 2) sound(game, link[1]);
    game.flags[tile] &= 0xef00;
  }
  updateProjectiles(game, dt);
  if (game.status !== 'playing') return;
  for (const actor of game.actors) {
    if (actor.dead) {
      advanceAnimation(game, actor, dt);
      const sequence = game.catalog.enemyTypes[actor.type]?.phases[3] || [];
      if (!actor.lootDropped && actor.phaseTime >= sequence.length / 7) dropLoot(game, actor);
      continue;
    }
    if (actor.type >= 6) continue;
    actor.cooldown -= dt;
    const dist = Math.hypot(actor.x - p.x, actor.y - p.y);
    if (actor.phase !== 0) advanceAnimation(game, actor, dt);
    if (game.status !== 'playing') break;
    if (dist > 14 || !visible(game, actor, p)) continue;
    detectPlayer(game, actor);
    if ([1, 2].includes(actor.phase) && actor.phaseTime < framesFor(game, actor).length / 8) continue;
    const range = actor.type === 0 ? .9 : 6;
    if (dist > range) {
      setPhase(game, actor, 0);
      advanceAnimation(game, actor, dt);
      const speed = dt * (actor.type === 0 ? 1 : .65);
      move(game, actor, (p.x - actor.x) / dist * speed, (p.y - actor.y) / dist * speed, true);
    } else if (actor.cooldown <= 0) {
      actor.cooldown = actor.type === 0 ? .8 : 1.5;
      setPhase(game, actor, 1, true);
      if (game.status === 'dead') break;
    } else setPhase(game, actor, 0);
  }
}
export function actorImage(game, actor) {
  const type = game.catalog.enemyTypes[actor.type];
  const sequence = type?.phases[actor.phase] || [];
  const frames = sequence;
  const i = Math.floor(actor.phaseTime * animationRate(actor));
  const frame = frames.length ? frames[actor.dead || (actor.type < 6 && actor.phase !== 0) ? Math.min(i, frames.length - 1) : i % frames.length].frame : 0;
  return `${type?.prefix || 'PNS'}_${frame}`;
}
export function saveGame(game, episode, level) {
  return JSON.stringify({ version: 1, episode, level, player: game.player, actors: game.actors,
    scenery: game.scenery, doors: game.doors, projectiles: game.projectiles, flags: game.flags, time: game.time, kills: game.kills,
    randomState: game.randomState, ambientRemaining: game.ambientRemaining });
}
export function loadGame(raw, maps, catalog) {
  try {
    const s = JSON.parse(raw);
    const ids = catalog.episodes[s.episode]?.maps;
    if (s.version !== 1 || !ids || !Number.isInteger(s.level) || !ids[s.level]) return null;
    const g = createGame(maps[ids[s.level]], catalog);
    if (!s.player || ![s.player.x, s.player.y, s.player.angle, s.player.health].every(Number.isFinite) ||
      s.player.x < 0 || s.player.x >= 64 || s.player.y < 0 || s.player.y >= 64 || s.player.health <= 0 ||
      s.flags?.length !== 4096 || s.actors?.length !== g.actors.length || (s.scenery?.length < g.scenery.length || s.scenery?.length > g.scenery.length + g.actors.length) ||
      s.doors?.length !== g.doors.length || s.player.ammo?.length !== 4 || s.player.owned?.length !== 4 ||
      s.player.keys?.length !== 3 || !Number.isInteger(s.player.weapon) || s.player.weapon < 0 || s.player.weapon > 3) return null;
    const point = (a) => a && Number.isFinite(a.x) && a.x >= 0 && a.x < 64 && Number.isFinite(a.y) && a.y >= 0 && a.y < 64;
    if (!s.flags.every((f) => Number.isInteger(f) && f >= 0 && f <= 65535) ||
      !s.player.ammo.every((a) => Number.isInteger(a) && a >= 0 && a <= 99) ||
      !s.player.owned.every((a) => typeof a === 'boolean') || !s.player.keys.every((a) => typeof a === 'boolean') ||
      !s.player.owned[s.player.weapon] || s.player.health > 99 || !Number.isInteger(s.player.lives) || s.player.lives < 1 || s.player.lives > 9 ||
      !s.actors.every((a, i) => point(a) && a.type === g.actors[i].type && Number.isFinite(a.health) && Number.isFinite(a.phaseTime) && Number.isFinite(a.cooldown)) ||
      !s.scenery.every((a, i) => point(a) && (i < g.scenery.length
        ? a.type === g.scenery[i].type
        : Number.isInteger(a.dropFrom) && s.actors[a.dropFrom]?.dead &&
          a.type === catalog.enemyTypes[s.actors[a.dropFrom].type]?.loot)) ||
      new Set(s.scenery.slice(g.scenery.length).map((a) => a.dropFrom)).size !== s.scenery.length - g.scenery.length ||
      !s.doors.every((a, i) => point(a) && a.x === g.doors[i].x && a.y === g.doors[i].y && a.type === g.doors[i].type && Number.isFinite(a.open) && a.open >= 0 && a.open <= 1 && [0, 1].includes(a.target) && Number.isFinite(a.hold)) ||
      (s.projectiles && (!Array.isArray(s.projectiles) || !s.projectiles.every((a) => point(a) && [6,7,8].includes(a.type) && [a.angle,a.age,a.phaseTime].every(Number.isFinite))))) return null;
    Object.assign(g, { projectiles: (s.projectiles || []).map((shot) => ({ ...shot, phase: shot.dead ? 3 : 1 })), player: s.player, actors: s.actors, scenery: s.scenery, doors: s.doors,
      flags: s.flags, time: Number(s.time) || 0, kills: Number(s.kills) || 0 });
    if (Number.isInteger(s.randomState)) g.randomState = s.randomState >>> 0;
    if (Number.isFinite(s.ambientRemaining) && s.ambientRemaining >= 0 && s.ambientRemaining <= 850 * .066) g.ambientRemaining = s.ambientRemaining;
    return { game: g, episode: String(s.episode), level: s.level };
  } catch { return null; }
}
