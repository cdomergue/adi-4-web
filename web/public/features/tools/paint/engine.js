export const WIDTH = 475, HEIGHT = 340;
export function colorBytes(color) {
  if (!/^#[\da-f]{6}$/i.test(color)) throw new Error('Couleur invalide');
  return [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16)).concat(255);
}
export function createPaper(color = '#fcfcfc') {
  const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4), rgba = colorBytes(color);
  for (let i = 0; i < pixels.length; i += 4) pixels.set(rgba, i);
  return pixels;
}
function dot(pixels, x, y, color, size = 1) {
  x = Math.round(x); y = Math.round(y);
  const r = (size - 1) / 2;
  for (let dy = -Math.ceil(r); dy <= r; dy++) for (let dx = -Math.ceil(r); dx <= r; dx++) {
    if (dx * dx + dy * dy > r * r + 0.5) continue;
    const px = x + dx, py = y + dy;
    if (px >= 0 && py >= 0 && px < WIDTH && py < HEIGHT) pixels.set(color, (py * WIDTH + px) * 4);
  }
}
function line(pixels, a, b, color, size) {
  let [x, y] = a.map(Math.round); const [x2, y2] = b.map(Math.round);
  const dx = Math.abs(x2 - x), dy = -Math.abs(y2 - y), sx = x < x2 ? 1 : -1, sy = y < y2 ? 1 : -1;
  let error = dx + dy;
  for (;;) {
    dot(pixels, x, y, color, size);
    if (x === x2 && y === y2) break;
    const e = 2 * error;
    if (e >= dy) { error += dy; x += sx; }
    if (e <= dx) { error += dx; y += sy; }
  }
}
export function symmetryPairs(a, b, enabled) {
  const pairs = [[a, b]];
  if (enabled) {
    for (const [flipX, flipY] of [[true, false], [false, true], [true, true]]) {
      const flip = ([x, y]) => [flipX ? WIDTH - 1 - x : x, flipY ? HEIGHT - 1 - y : y];
      pairs.push([flip(a), flip(b)]);
    }
  }
  return pairs;
}
export function draw(pixels, { tool, from, to, color, size = 1, symmetric = false }) {
  const rgba = colorBytes(color);
  for (const [a, b] of symmetryPairs(from, to, symmetric)) {
    if (['pencil', 'brush', 'eraser', 'line'].includes(tool)) line(pixels, a, b, rgba, size);
    else if (tool === 'rectangle' || tool === 'filledRectangle') {
      const x1 = Math.round(Math.min(a[0], b[0])), x2 = Math.round(Math.max(a[0], b[0]));
      const y1 = Math.round(Math.min(a[1], b[1])), y2 = Math.round(Math.max(a[1], b[1]));
      if (tool === 'filledRectangle') {
        for (let y = Math.max(0, y1); y <= Math.min(HEIGHT - 1, y2); y++)
          for (let x = Math.max(0, x1); x <= Math.min(WIDTH - 1, x2); x++) dot(pixels, x, y, rgba);
      } else {
        line(pixels, [x1, y1], [x2, y1], rgba, size); line(pixels, [x2, y1], [x2, y2], rgba, size);
        line(pixels, [x2, y2], [x1, y2], rgba, size); line(pixels, [x1, y2], [x1, y1], rgba, size);
      }
    } else if (tool === 'circle' || tool === 'filledCircle') {
      const radius = Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]));
      const outer = radius + (size - 1) / 2, inner = Math.max(0, outer - size);
      for (let y = Math.max(0, Math.floor(a[1] - outer)); y <= Math.min(HEIGHT - 1, a[1] + outer); y++)
        for (let x = Math.max(0, Math.floor(a[0] - outer)); x <= Math.min(WIDTH - 1, a[0] + outer); x++) {
          const d = (x - a[0]) ** 2 + (y - a[1]) ** 2;
          if (d <= outer ** 2 && (tool === 'filledCircle' || d >= inner ** 2)) dot(pixels, x, y, rgba);
        }
    }
  }
  return pixels;
}
export function selectionRect(a, b) {
  const x = Math.max(0, Math.min(WIDTH - 1, Math.round(Math.min(a[0], b[0]))));
  const y = Math.max(0, Math.min(HEIGHT - 1, Math.round(Math.min(a[1], b[1]))));
  return [x, y, Math.min(WIDTH - x, Math.abs(Math.round(a[0] - b[0])) + 1), Math.min(HEIGHT - y, Math.abs(Math.round(a[1] - b[1])) + 1)];
}
export function copySelection(pixels, rect) {
  const [x, y, width, height] = rect, data = new Uint8ClampedArray(width * height * 4);
  for (let row = 0; row < height; row++) data.set(pixels.slice(((y + row) * WIDTH + x) * 4, ((y + row) * WIDTH + x + width) * 4), row * width * 4);
  return { data, width, height };
}
export function pasteSelection(pixels, selection, x, y) {
  x = Math.round(x); y = Math.round(y);
  for (let row = 0; row < selection.height; row++) for (let col = 0; col < selection.width; col++) {
    if (x + col < 0 || y + row < 0 || x + col >= WIDTH || y + row >= HEIGHT) continue;
    const source = (row * selection.width + col) * 4;
    if (selection.data[source + 3]) pixels.set(selection.data.subarray(source, source + 4), ((y + row) * WIDTH + x + col) * 4);
  }
}
