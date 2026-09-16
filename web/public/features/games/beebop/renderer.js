import { FINALE_DURATION } from './presentation.js';

// BeeBop I: original client coordinates, without DOM layout or simulation writes.
// Resource numbers below are LOADICON group IDs, not child resource indices.
const ROOT = '/game/beebop1/';
const LEFT = 15;
const TOP = 11;
const WIDTH = 480;
const HEIGHT = 295;
const TILE = 30;
const COLUMNS = 16;
const ROWS = 10;
const BACKGROUND_TILE_SIZE = {
  '1010:1d9e': 8,
  '1010:2413': 16,
  '1010:2512': 32,
  '1010:2320': 64,
};
const ICONS = {
  1: 147, 3: 148, 4: 149, 5: 165, 6: 165, 7: 128, b: 129,
  P: 170, Q: 171, R: 175, S: 172, T: 174, U: 177, V: 173, W: 176,
};

const artworkPromises = new Map();
const backgroundTiles = new WeakMap();

function loadImage(path) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`BeeBop artwork could not load: ${path}`));
    image.src = path;
  });
}

// 1010:2a49 uses the two 20px halves of bitmap742, not icon741.
function makeBall(image) {
  const source = new OffscreenCanvas(40, 20).getContext('2d');
  source.drawImage(image, 0, 0);
  const pixels = source.getImageData(0, 0, 40, 20).data;
  const ball = new OffscreenCanvas(19, 19);
  const ctx = ball.getContext('2d');
  const result = ctx.createImageData(19, 19);
  for (let y = 0; y < 19; y += 1) {
    for (let x = 0; x < 19; x += 1) {
      const mask = (y * 40 + x) * 4;
      const color = mask + 20 * 4;
      const target = (y * 19 + x) * 4;
      result.data.set(pixels.subarray(color, color + 3), target);
      result.data[target + 3] = pixels[mask] === 0 ? 255 : 0;
    }
  }
  ctx.putImageData(result, 0, 0);
  return ball;
}

/** Load original exported PNGs once; a failed request can be retried. */
export async function loadArtwork(base = ROOT) {
  const root = base.endsWith('/') ? base : `${base}/`;
  if (!artworkPromises.has(root)) {
    const promise = (async () => {
      const response = await fetch(`${root}artwork.json`);
      if (!response.ok) throw new Error(`BeeBop artwork manifest: HTTP ${response.status}`);
      const manifest = await response.json();
      const [bitmaps, icons] = await Promise.all(['bitmaps', 'icons'].map(async group => {
        const entries = await Promise.all(Object.entries(manifest[group]).map(async ([id, item]) => {
          const path = typeof item === 'string' ? item : item.path;
          return [id, await loadImage(path.startsWith('/') ? path : root + path)];
        }));
        return Object.fromEntries(entries);
      }));
      return { bitmaps, icons, ball: makeBall(bitmaps[742]), manifest };
    })().catch(error => {
      artworkPromises.delete(root);
      throw error;
    });
    artworkPromises.set(root, promise);
  }
  return artworkPromises.get(root);
}

function icon(ctx, artwork, id, x, y) {
  const image = artwork.icons[id];
  if (!image) throw new Error(`Missing BeeBop icon ${id}`);
  ctx.drawImage(image, Math.trunc(x), Math.trunc(y));
}

function pattern(ctx, image, x, y, width, height, originX = x, originY = y) {
  if (!image) throw new Error('Missing BeeBop bitmap');
  ctx.save();
  ctx.translate(originX, originY);
  ctx.fillStyle = ctx.createPattern(image, 'repeat');
  ctx.fillRect(x - originX, y - originY, width, height);
  ctx.restore();
}

function backgroundTile(image, renderer) {
  const size = BACKGROUND_TILE_SIZE[renderer];
  if (!image || !size || (image.width === size && image.height === size)) return image;
  let tiles = backgroundTiles.get(image);
  if (!tiles) {
    tiles = new Map();
    backgroundTiles.set(image, tiles);
  }
  if (!tiles.has(size)) {
    const tile = new OffscreenCanvas(size, size);
    const ctx = tile.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    // Native BitBlt reads only this source rectangle, without scaling. Stage 24
    // uses the top-left 16x16 of bitmap324 (32x32), per 1010:24c1..24d1.
    ctx.drawImage(image, 0, 0, size, size, 0, 0, size, size);
    tiles.set(size, tile);
  }
  return tiles.get(size);
}

function character(cells, index) {
  const value = cells?.[index];
  return typeof value === 'number' ? String.fromCharCode(value) : value;
}

function originalCell(state, index) {
  return character(state.artCells ?? state.level?.cells ?? state.cells, index);
}

function cellIcon(kind) {
  if (kind >= 'A' && kind <= 'O') return 2000;
  return ICONS[kind];
}

// 1010:1d9e. Frame coordinates include the original lower score strip.
function drawFrame(ctx, artwork) {
  pattern(ctx, artwork.bitmaps[4002], 14, 320, 481, 30, 0, 0);
  icon(ctx, artwork, 131, 4, 0);
  icon(ctx, artwork, 133, 490, 0);
  icon(ctx, artwork, 135, 490, 345);
  icon(ctx, artwork, 136, 4, 345);
  for (const x of [4, 495]) {
    for (let row = 0; row <= 21; row += 1) icon(ctx, artwork, 134, x, 16 + row * 15);
    icon(ctx, artwork, 134, x, 292);
  }
  for (const y of [0, 311]) {
    for (let col = 0; col <= 30; col += 1) icon(ctx, artwork, 137, 17 + col * 15, y);
    icon(ctx, artwork, 137, 478, y);
  }
  icon(ctx, artwork, 132, 4, 311);
  icon(ctx, artwork, 138, 492, 311);
  for (let col = 0; col <= 30; col += 1) icon(ctx, artwork, 137, 20 + col * 15, 350);
  icon(ctx, artwork, 137, 476, 350);
}

function drawHud(ctx, state, artwork) {
  ctx.drawImage(artwork.bitmaps[141], 15, 322);
  ctx.drawImage(artwork.bitmaps[14], 222, 325);
  icon(ctx, artwork, 741, 325, 327);
  icon(ctx, artwork, 140, 363, 329);
  // Numbers are rendered by the view's crisp HTML layer.
}

function drawCell(ctx, state, artwork, index, kind, x, y) {
  const original = originalCell(state, index);
  // A plain '2' has collision geometry but no initial icon in 1008:6e15.
  const id = cellIcon(original) ?? cellIcon(kind);
  if (id !== undefined) icon(ctx, artwork, id, x, y);
  // 1000:120b / 1008:1645: damage icons overlay the existing brick.
  if (kind === 'Y' || (kind === '1' && original >= 'P' && original <= 'W')) {
    icon(ctx, artwork, 500, x, y);
  }
  if (kind === '1' && original >= 'P' && original <= 'W') icon(ctx, artwork, 501, x, y);
}

function drawCells(ctx, state, artwork, left, top) {
  const laserIndices = [];
  for (let i = 0; i < COLUMNS * ROWS; i += 1) {
    if (originalCell(state, i) === '7') laserIndices.push(i);
  }
  const tick = Math.max(0, Math.trunc(state.tick ?? 0));
  for (let i = 0; i < COLUMNS * ROWS; i += 1) {
    const kind = character(state.cells, i);
    if (!kind || kind === '0' || (kind === '6' && state.enemy)) continue;
    const x = left + (i % COLUMNS) * TILE;
    const y = top + Math.floor(i / COLUMNS) * TILE;
    drawCell(ctx, state, artwork, i, kind, x, y);
    // 1008:01e1 advances ONE star per simulation tick, including dead slots.
    if (kind === '7') {
      const slot = laserIndices.indexOf(i);
      const advances = slot < 0 ? 0 : Math.floor((tick + laserIndices.length - 1 - slot) / laserIndices.length);
      if (advances > 0) ctx.drawImage(artwork.bitmaps[2001 + ((advances - 1) % 16)], x, y);
    }
  }
}

// 1000:0a45: erase opposing 2px strips, then display a coloured sparkle.
// Animated events are retained by the caller with their creation tick (or age).
function drawDestruction(ctx, state, artwork, left, top) {
  for (const event of state.explosions ?? []) {
    if (!Number.isInteger(event.index) || event.index < 0 || event.index >= 160) continue;
    const original = originalCell(state, event.index);
    const kind = event.kind ?? (original === '7' || original === 'b' ? original : '1');
    if (!['1', '7', 'b'].includes(kind)) continue;
    const age = Math.max(0, Math.trunc(event.age ?? ((state.tick ?? 0) - (event.tick ?? state.tick ?? 0))));
    if (age >= 20 || character(state.cells, event.index) !== '0') continue;
    const x = left + (event.index % COLUMNS) * TILE;
    const y = top + Math.floor(event.index / COLUMNS) * TILE;
    if (age >= 13) {
      icon(ctx, artwork, 142 + (event.colour ?? 0) % 3, x, y);
    } else if (age < 12) {
      const insetY = Math.min(age, 5) * 2;
      const insetX = Math.max(0, age - 5) * 2;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + insetX, y + insetY, TILE - insetX * 2, TILE - insetY * 2);
      ctx.clip();
      drawCell(ctx, state, artwork, event.index, kind, x, y);
      ctx.restore();
    }
  }
}

/**
 * Draw at native client coordinates; the caller owns canvas size and scaling.
 * A 510x360 canvas includes the frame/HUD; the playfield is (15,11,480,295).
 * Crisp counters occupy level (15,322,39,28), score (115,326,86,24),
 * lives (395,326,50,22). Explosions accept {index,tick}, optionally kind/age/colour.
 * Keep explosions until tick - explosion.tick >= 20; colour 0/1/2 selects the
 * native blue/green/red sparkle. Without colour, the first (blue) is used.
 * Phase overlays and native level-entry/life-loss sequences belong to the caller;
 * ready/playing/won/gameover all draw their supplied board state here.
 * A configurable artwork root does not change these episode-I rendering rules.
 * No timers, randomness, DOM nodes, or writes to state. Call again after a tick.
 */
export function drawGame(ctx, state, artwork, presentation = null) {
  const left = state.bounds?.left ?? LEFT;
  const top = state.bounds?.top ?? TOP;
  const right = state.bounds?.right ?? LEFT + WIDTH;
  const bottom = state.bounds?.bottom ?? TOP + HEIGHT;
  const stage = state.level?.id ?? state.level?.stage ?? 1;
  const background = state.level?.backgroundBitmap ?? state.level?.background_bitmap ?? 300 + stage;
  ctx.save();
  try {
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    drawFrame(ctx, artwork);
    drawHud(ctx, state, artwork);
    ctx.save();
    try {
      ctx.beginPath();
      // The last row extends 5px below the collision floor (1008:6e15).
      // Paddles at y=303 must also retain their full native 6px height.
      ctx.rect(left, top, right - left, bottom - top + 5);
      ctx.clip();
      if (presentation?.type === 'entry') {
        ctx.beginPath();
        const count = Math.min(160, Math.floor(presentation.elapsed / 10));
        for (let k = 0; k < count; k++) {
          const index = (13 * (k + 1) - 1) % 160;
          ctx.rect(left + index % 16 * 30, top + Math.floor(index / 16) * 30, 30, 30);
        }
        ctx.clip();
      }
      const tile = backgroundTile(artwork.bitmaps[background], state.level?.backgroundRenderer);
      pattern(ctx, tile, left, top, right - left, bottom - top + 5);
      drawCells(ctx, state, artwork, left, top);
      drawDestruction(ctx, state, artwork, left, top);
      if (state.enemy) icon(ctx, artwork, 165, state.enemy.x, state.enemy.y);
      if (state.paddle) {
        const { x, y, width } = state.paddle;
        pattern(ctx, artwork.bitmaps[state.laser ? 155 : 136], Math.trunc(x), Math.trunc(y), width, 6, 0, 0);
      }
      if (state.missile) {
        pattern(ctx, artwork.bitmaps[169], Math.trunc(state.missile.x), Math.trunc(state.missile.y), 5, 15, 0, 0);
      }
      // The bitmap's 15x15 ball has 2px transparent margins in its 19px blit.
      if (presentation?.type === 'loss') {
        const frame = Math.min(2, Math.floor(presentation.elapsed / (1000 / 6)));
        icon(ctx, artwork, 1000 + frame, presentation.x, presentation.y);
      } else if (state.ball && state.phase === 'playing') {
        ctx.drawImage(artwork.ball, Math.trunc(state.ball.x - 2), Math.trunc(state.ball.y - 2));
      }
      if (presentation?.type === 'win') ctx.drawImage(artwork.bitmaps[621], 155, 105);
    } finally {
      ctx.restore();
    }
  } finally {
    ctx.restore();
  }
}

/** 1008:0700/b1f3: original 551x363 menu. Buttons and text use an HTML layer. */
export function drawMenu(ctx, artwork, ball, speed, sound) {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 551, 363);
  for (const [i, color] of ['#0000cc', '#0033cc', '#0033cc', '#0066cc', '#3399ff'].entries()) {
    ctx.strokeStyle = color;
    ctx.strokeRect(i + 0.5, i + 0.5, 550 - i * 2, 362 - i * 2);
  }
  ctx.fillStyle = '#3399ff';
  ctx.fillRect(5, 130, 336, 1);
  ctx.fillRect(341, 5, 1, 352);
  ctx.fillRect(341, 180, 204, 1);
  for (const [id, x, y] of [[59, 54, 25], [60, 372, 35], [1050, 90, 165],
    [1011, 150, 322], [1001, 247, 322], [1006, 425, 322], [sound ? 7 : 6, 53, 322]]) {
    ctx.drawImage(artwork.bitmaps[id], x, y);
  }
  ctx.fillStyle = '#f00';
  ctx.fillRect(500, 136 - speed, 8, speed);
  ctx.drawImage(artwork.ball, ball.x, ball.y);
}

/** 1008:8925 / 8bd5 / 8f50. Reconstruct accumulated Win16 blits at any time. */
export function drawEnding(ctx, state, artwork, presentation) {
  drawGame(ctx, state, artwork);
  if (presentation.type === 'gameover') {
    ctx.fillStyle = '#ff9900';
    ctx.fillRect(14, 10, 481, 301);
    ctx.drawImage(artwork.bitmaps[1031], 200, 140);
    return;
  }
  const tick = Math.floor(Math.min(presentation.elapsed, FINALE_DURATION) / 5);
  const left = 15, top = 11, right = 495, bottom = 306;
  // 74 pairs of four-pixel strips copy the cyan back buffer towards the middle.
  const strip = Math.min(74, tick + 1);
  pattern(ctx, artwork.bitmaps[1200], left, top, 479, Math.min(295, strip * 2 + 2), left, top);
  pattern(ctx, artwork.bitmaps[1200], left, bottom - strip * 2 + 1, 479, strip * 2 + 2, left, top);
  if (tick >= 74) {
    const expansion = Math.min(147, tick - 74);
    ctx.fillStyle = '#fff';
    ctx.fillRect(left + 147 - expansion, top + 148 - expansion,
      186 + expansion * 2, expansion * 2);
  }
  if (tick >= 222) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(left, bottom, 480, 4);
    pattern(ctx, artwork.bitmaps[4002], 12, 320, 483, 30, 0, 0);
    const bands = Math.min(100, tick - 222 + 1);
    for (let i = 0; i < bands; i++) {
      ctx.fillStyle = `rgb(0 0 ${Math.trunc((100 - i) * 255 / 100)})`;
      ctx.fillRect(left, top + i * 3, 480, 3);
    }
  }
  if (presentation.elapsed >= FINALE_DURATION) ctx.drawImage(artwork.bitmaps[1031], 190, 60);
}
