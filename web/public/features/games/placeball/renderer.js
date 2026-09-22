import { COLS, ROWS, TILE, family } from './engine.js';

function surface(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  return canvas;
}

function masked(image, x, y, maskX, maskY, size) {
  const canvas = surface(size, size), ctx = canvas.getContext('2d');
  ctx.drawImage(image, maskX, maskY, size, size, 0, 0, size, size);
  const mask = ctx.getImageData(0, 0, size, size);
  ctx.drawImage(image, x, y, size, size, 0, 0, size, size);
  const pixels = ctx.getImageData(0, 0, size, size);
  for (let p = 0; p < pixels.data.length; p += 4) pixels.data[p + 3] = 255 - mask.data[p];
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

export async function loadArtwork() {
  const artwork = {};
  await Promise.all([102, 103, 104, 105, 106, 107].map(async id => {
    const image = new Image(); image.src = `/game/placeball/bitmap-${id}.png`;
    await image.decode(); artwork[id] = image;
  }));
  artwork.ball = masked(artwork[104], 25, 0, 475, 0, 24);
  artwork.mascot = Array.from({ length: 8 }, (_, i) =>
    masked(artwork[106], 182 + Math.floor(i / 4) * 91, i % 4 * 91,
      Math.floor(i / 4) * 91, i % 4 * 91, 90));
  artwork.blink = surface(96, 24);
  const ctx = artwork.blink.getContext('2d');
  ctx.drawImage(artwork[104], 50, 0, 99, 24, 0, 0, 99, 24);
  const floor = surface(24, 24).getContext('2d');
  floor.drawImage(artwork[104], 0, 0);
  const pixels = ctx.getImageData(0, 0, 96, 24), bg = floor.getImageData(0, 0, 24, 24);
  // Each launcher uses a one-pixel separator in the source atlas.
  for (let tile = 0; tile < 4; tile++)
    ctx.drawImage(artwork[104], 50 + tile * 25, 0, 24, 24, tile * 24, 0, 24, 24);
  const launchers = ctx.getImageData(0, 0, 96, 24);
  for (let y = 0; y < 24; y++) for (let x = 0; x < 96; x++) for (let c = 0; c < 3; c++) {
    const p = (y * 96 + x) * 4 + c;
    pixels.data[p] = launchers.data[p] ^ bg.data[(y * 24 + x % 24) * 4 + c];
  }
  ctx.putImageData(pixels, 0, 0);
  return artwork;
}

const atlasBase = { 0: 0, 1: 150, 2: 175, 3: 350, 4: 50, 5: 400, 6: 225 };

export function drawGame(ctx, artwork, state, { menu = false, mascot = null } = {}) {
  ctx.imageSmoothingEnabled = false;
  for (let x = -8; x < 640; x += TILE) for (let y = -8; y < 440; y += TILE)
    ctx.drawImage(artwork[104], 0, 0, TILE, TILE, x, y, TILE, TILE);
  if (!menu) {
    for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) {
      const i = x * ROWS + y, cell = state.board[i], kind = family(cell);
      const variant = kind === 3 ? Math.floor(state.elapsed / 150) % 2 : cell % 100;
      const selected = state.phase === 'ready' && state.launchers[state.selected] === i &&
        Math.floor(state.elapsed / 150) % 2;
      ctx.drawImage(selected ? artwork.blink : artwork[104],
        selected ? variant * 24 : atlasBase[kind] + variant * 25, 0, 24, 24,
        8 + x * TILE, 8 + y * TILE, 24, 24);
    }
    if (state.ball) {
      const { x, y } = state.ball;
      if (state.phase === 'dying') {
        // A permutation of all 576 pixels: native deletion cadence 2 ms, hold to 1400 ms.
        const removed = Math.min(576, Math.floor(state.phaseTime / 2));
        for (let p = 0; p < 576; p++) if ((p * 337 + state.seed * 53) % 576 >= removed)
          ctx.drawImage(artwork.ball, p % 24, Math.floor(p / 24), 1, 1,
            8 + x + p % 24, 8 + y + Math.floor(p / 24), 1, 1);
      } else ctx.drawImage(artwork.ball, 8 + x, 8 + y);
    }
    ctx.fillStyle = '#000'; ctx.fillRect(0, 399, 640, 41);
    ctx.drawImage(artwork[105], -1, 400);
    for (const [number, x, length, max] of [[state.levelIndex + 1, 252, 3, 999],
      [state.lives, 403, 3, 999], [state.score, 549, 6, 999999]]) {
      const value = number > max ? (number - 1) % max + 1 : number;
      for (const [i, char] of [...String(value).padStart(length, ' ')].entries())
        ctx.drawImage(artwork[107], (char === ' ' ? 10 : Number(char)) * 11, 0, 11, 14,
          x + i * 13, 413, 11, 14);
    }
  }
  if (mascot) {
    const frame = Math.floor(mascot.elapsed / 50);
    ctx.drawImage(artwork.mascot[frame % 8], -90 + frame * 8, mascot.y);
  }
}
