const artworkPromises = new Map();

function loadImage(path) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`BeeBop artwork could not load: ${path}`));
    image.src = path;
  });
}

// 1010:2a49 uses the two 20px halves of bitmap742, not icon741.
export function makeBall(image) {
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
export async function loadArtwork(base = '/game/beebop1/') {
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
      const balls = Object.fromEntries([742, 743, 744, 745, 746, 747]
        .filter(id => bitmaps[id]).map(id => [id - 741, makeBall(bitmaps[id])]));
      return { bitmaps, icons, ball: balls[1], balls, manifest };
    })().catch(error => {
      artworkPromises.delete(root);
      throw error;
    });
    artworkPromises.set(root, promise);
  }
  return artworkPromises.get(root);
}
