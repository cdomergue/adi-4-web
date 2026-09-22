import { deathLines, lineCommands } from './death-lines.js';

// Original client coordinates. LOADICON ids refer to group resources.
function bitmap(ctx, art, id, x, y) {
  const image = art.bitmaps[id];
  if (!image) throw new Error(`Missing BeeBop II bitmap ${id}`);
  ctx.drawImage(image, Math.trunc(x), Math.trunc(y));
}

function icon(ctx, art, id, x, y) {
  const image = art.icons[id];
  if (!image) throw new Error(`Missing BeeBop II icon ${id}`);
  ctx.drawImage(image, Math.trunc(x), Math.trunc(y));
}

function tile(ctx, image, x, y, width, height) {
  ctx.fillStyle = ctx.createPattern(image, 'repeat');
  ctx.fillRect(x, y, width, height);
}

// 1020:038e/01f4/09cd/0831: an 8px strip propagates between the end markers.
export function drawDeathLines(ctx, state, art) {
  for (const line of deathLines(state)) for (const [op, ...v] of lineCommands(line)) {
    if (op === 'icon') icon(ctx, art, v[0], v[1], v[2]);
    else {
      const [l, t, , , dl, dt, dr, db] = v;
      ctx.drawImage(ctx.canvas, l, t, dr-dl, db-dt, dl, dt, dr-dl, db-dt);
    }
  }
}

export function drawGame(ctx, state, art, campaign, presentation = null) {
  ctx.imageSmoothingEnabled = false;
  tile(ctx, art.bitmaps[134], 0, 0, 640, 480);
  ctx.fillStyle = '#000';
  ctx.fillRect(19, 3, 600, 32);
  tile(ctx, art.bitmaps[1001 + state.levelIndex], 31, 49, 578, 394);
  for (let i = 0; i < 247; i++) {
    const kind = state.cells[i];
    if (kind === 48) continue;
    const source = campaign.cellTypes[state.artCells[i]];
    const x = 35 + i % 19 * 30, y = 51 + Math.floor(i / 19) * 30;
    for (const id of source.icons) icon(ctx, art, id, x, y);
    if (source.kind === 65) {
      for (const id of kind === 66 ? [137] : kind === 67 ? [137, 138] :
        kind === 49 ? [137, 138, 139] : []) icon(ctx, art, id, x, y);
    }
  }
  if (presentation?.type !== 'build') drawDeathLines(ctx, state, art);
  const p = state.paddle;
  bitmap(ctx, art, 5001 + state.weapon, p.x, p.y);
  if (state.phase === 'playing') for (const m of state.missiles) {
    if (!m.stopped) bitmap(ctx, art, 5000, m.x, m.y);
  }
  if (state.phase === 'playing') {
    ctx.drawImage(art.balls[state.ballStyle], state.ball.x - 10, state.ball.y - 10);
  }
  // 1008:4962: French labels, reserve paddle and multiplication sign.
  for (const [id, x, y] of [[22051, 120, 11], [22031, 22, 11],
    [22011, 580, 8], [5001 + state.weapon, 439, 18]]) bitmap(ctx, art, id, x, y);
  icon(ctx, art, 223, 491, 18);
  bitmap(ctx, art, 22041, 284, 5);
  bitmap(ctx, art, state.weapon ? 22061 : 22071, 360, 12);
  if (state.weapon) {
    ctx.save();
    ctx.globalCompositeOperation = 'difference';
    ctx.fillStyle = '#fff';
    if (state.weaponFlashLabel) ctx.fillRect(284, 10, 64, 16);
    if (state.weaponFlashStatus) ctx.fillRect(358, 12, 47, 14);
    ctx.restore();
  }
  if (presentation?.type === 'won') {
    tile(ctx, art.bitmaps[134], 19, 35, 600, 415);
    bitmap(ctx, art, 2621, 220, 175);
  }
  if (presentation?.type === 'gameover' || presentation?.type === 'finale') {
    tile(ctx, art.bitmaps[presentation.type === 'finale' ? 128 : 1], 0, 0, 640, 480);
  }
}

export function drawMenu(ctx, art, ball, speed) {
  ctx.imageSmoothingEnabled = false;
  tile(ctx, art.bitmaps[134], 0, 0, 640, 480);
  for (const [id, x, y] of [[2142, 246, 43], [2129, 280, 150], [2140, 560, 60],
    [2131, 1, 3], [22081, 30, 333], [4002, 62, 145]]) bitmap(ctx, art, id, x, y);
  tile(ctx, art.bitmaps[72], 67, 150, 108, 120);
  ctx.fillStyle = '#f00';
  ctx.fillRect(190, 246 - speed, 8, speed);
  ctx.drawImage(art.balls[6], ball.x, ball.y);
}

// Execute a finite list of exported GDI blits, not native machine code. Keeping
// accumulated pixels is essential: these animations repeatedly copy their own
// preceding image. Drawing only the last rectangle loses the moving edges.
export function createTransition(ctx, art, commands, backgroundId) {
  const surface = new OffscreenCanvas(640, 480), buffer = surface.getContext('2d');
  buffer.imageSmoothingEnabled = false;
  buffer.drawImage(ctx.canvas, 0, 0);
  const background = new OffscreenCanvas(640, 480), back = background.getContext('2d');
  tile(back, art.bitmaps[backgroundId], 0, 0, 640, 480);
  let index = 0, time = 0;
  const duration = commands.reduce((sum, c) => sum + (c[0] === 'wait' ? c[1] : 0), 0);
  return { duration, draw(ctx, elapsed) {
    while (index < commands.length && time <= elapsed) {
      const [op, ...v] = commands[index++];
      if (op === 'wait') time += v[0];
      else if (op === 'icon') icon(buffer, art, v[0], v[1], v[2]);
      else if (op === 'background') {
        const [l, t, r, b] = v;
        if (r > l && b > t) buffer.drawImage(background, l, t, r-l, b-t, l, t, r-l, b-t);
      } else if (op === 'fill' || op === 'ellipse') {
        buffer.fillStyle = `rgb(${v.slice(0, 3).map(c => Math.trunc(c * 255 / 100)).join(',')})`;
        if (op === 'fill') buffer.fillRect(v[3], v[4], v[5]-v[3], v[6]-v[4]);
        else {
          const [width, l, t, r, b] = v.slice(3);
          buffer.beginPath();
          buffer.ellipse((l+r)/2, (t+b)/2, (r-l)/2, (b-t)/2, 0, 0, Math.PI*2);
          buffer.ellipse((l+r)/2, (t+b)/2, Math.max(0, (r-l)/2-width), Math.max(0, (b-t)/2-width), 0, 0, Math.PI*2);
          buffer.fill('evenodd');
        }
      } else if (op === 'copy') {
        const [l, t, , , dl, dt, dr, db] = v;
        if (dr > dl && db > dt) buffer.drawImage(surface, l, t, dr-dl, db-dt, dl, dt, dr-dl, db-dt);
      }
    }
    ctx.drawImage(surface, 0, 0);
  } };
}
