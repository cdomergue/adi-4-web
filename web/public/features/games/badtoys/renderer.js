import { actorImage, castRay } from './engine.js';
const WIDTH = 320, HEIGHT = 176, FOV = .66;
export function createRenderer(canvas, pictures) {
  const ctx = canvas.getContext('2d');
  canvas.width = WIDTH; canvas.height = 216;
  ctx.imageSmoothingEnabled = false;
  const pixels = ctx.createImageData(WIDTH, HEIGHT);
  const textures = new Map();
  for (const [name, picture] of Object.entries(pictures)) {
    if (!name.startsWith('STN_')) continue;
    const source = document.createElement('canvas'); source.width = source.height = 64;
    const c = source.getContext('2d'); c.drawImage(picture, 0, 0);
    textures.set(Number(name.slice(4)), c.getImageData(0, 0, 64, 64).data);
  }
  const depths = new Float32Array(WIDTH);
  function image(name, x, y, w, h) { const p = pictures[name]; if (p) ctx.drawImage(p, x, y, w, h); }
  return function render(game, showMap = false) {
    const p = game.player, dx = Math.cos(p.angle), dy = Math.sin(p.angle);
    const planeX = -dy * FOV, planeY = dx * FOV;
    // Textured floor/ceiling use the last two bytes of each open native cell.
    for (let y = 0; y < HEIGHT; y++) {
      const distance = HEIGHT / (2 * Math.abs(y - HEIGHT / 2 + .5));
      for (let x = 0; x < WIDTH; x++) {
        const camera = 2 * x / WIDTH - 1;
        const wx = p.x + distance * (dx + planeX * camera), wy = p.y + distance * (dy + planeY * camera);
        const tile = Math.floor(wy) * 64 + Math.floor(wx);
        const texture = textures.get(game.map.textures[tile * 4 + (y >= HEIGHT / 2 ? 2 : 3)] || 1);
        const from = (((Math.floor(wy * 64) & 63) * 64) + (Math.floor(wx * 64) & 63)) * 4;
        const to = (y * WIDTH + x) * 4, shade = Math.max(.3, 1 - distance / 30);
        for (let c = 0; c < 3; c++) pixels.data[to + c] = (texture?.[from + c] || 0) * shade;
        pixels.data[to + 3] = 255;
      }
    }
    ctx.putImageData(pixels, 0, 0);
    for (let x = 0; x < WIDTH; x++) {
      const camera = 2 * x / WIDTH - 1;
      const hit = castRay(game, p.x, p.y, dx + planeX * camera, dy + planeY * camera);
      depths[x] = hit.distance;
      const h = HEIGHT / hit.distance;
      const picture = pictures[`STN_${hit.texture}`] || pictures.STN_5;
      ctx.drawImage(picture, Math.min(63, Math.max(0, Math.floor(hit.u * 64))), 0, 1, 64,
        x, HEIGHT / 2 - h / 2, 1, h);
      const shade = Math.min(.75, hit.distance / 35 + (hit.side ? .13 : 0));
      ctx.fillStyle = `rgba(0,0,0,${shade})`; ctx.fillRect(x, HEIGHT / 2 - h / 2, 1, h);
    }
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, WIDTH, HEIGHT); ctx.clip();
    const objects = [...game.scenery.filter((s) => !s.removed).map((s) => ({ ...s, image: `VEC_${s.type}` })),
      ...[...game.actors, ...game.projectiles].map((a) => ({ ...a, image: actorImage(game, a) }))]
      .map((s) => ({ ...s, distance: (s.x - p.x) ** 2 + (s.y - p.y) ** 2 }))
      .sort((a, b) => b.distance - a.distance);
    for (const s of objects) {
      const relX = s.x - p.x, relY = s.y - p.y;
      const depth = dx * relX + dy * relY;
      if (depth < .15) continue;
      const lateral = (-dy * relX + dx * relY) / FOV;
      const size = HEIGHT / depth;
      const centre = WIDTH / 2 * (1 + lateral / depth);
      const left = centre - size / 2, top = HEIGHT / 2 - size / 2;
      const picture = pictures[s.image]; if (!picture) continue;
      for (let x = Math.max(0, Math.floor(left)); x < Math.min(WIDTH, left + size); x++) {
        if (depth < depths[x]) ctx.drawImage(picture, Math.min(63, Math.floor((x - left) * 64 / size)), 0, 1, 64, x, top, 1, size);
      }
    }
    const weapon = game.catalog.weapons[p.weapon];
    const frame = game.shot > 0 ? Math.min(weapon.frames.length - 1, Math.floor((game.shotDuration - game.shot) / .1)) : 0;
    image(`VEC_${weapon.frames[frame]}`, WIDTH / 2 - 64, HEIGHT - 128, 128, 128);
    ctx.strokeStyle = '#fff9'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(156, 88); ctx.lineTo(164, 88); ctx.moveTo(160, 84); ctx.lineTo(160, 92); ctx.stroke();
    if (game.hit > 0) { ctx.fillStyle = '#e0000038'; ctx.fillRect(0, 0, WIDTH, HEIGHT); }
    if (showMap) {
      ctx.fillStyle = '#000d'; ctx.fillRect(5, 5, 128, 128);
      for (let i = 0; i < 4096; i++) {
        ctx.fillStyle = game.flags[i] & 0x2000 ? '#888' : '#232b30';
        ctx.fillRect(5 + i % 64 * 2, 5 + Math.floor(i / 64) * 2, 2, 2);
      }
      ctx.fillStyle = '#ffd662'; ctx.fillRect(4 + p.x * 2, 4 + p.y * 2, 3, 3);
      ctx.strokeStyle = '#ffd662'; ctx.beginPath(); ctx.moveTo(5 + p.x * 2, 5 + p.y * 2); ctx.lineTo(5 + p.x * 2 + dx * 6, 5 + p.y * 2 + dy * 6); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#182730'; ctx.fillRect(0, HEIGHT, WIDTH, 40);
    ctx.fillStyle = '#ffce72'; ctx.font = 'bold 10px monospace';
    ctx.fillText('VIE', 8, 189); ctx.fillText('MUNITIONS', 62, 189); ctx.fillText('CLÉS', 142, 189); ctx.fillText('JOUETS', 198, 189); ctx.fillText('VIES', 269, 189);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 15px monospace';
    ctx.fillText(String(p.health), 8, 207); ctx.fillText(p.weapon === 0 ? '∞' : String(p.ammo[p.weapon]), 62, 207);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = p.keys[i] ? ['#f55', '#7df', '#ff6'][i] : '#43515a'; ctx.fillRect(142 + i * 13, 198, 8, 10); }
    ctx.fillStyle = '#fff'; ctx.fillText(String(game.kills), 198, 207); ctx.fillText(String(p.lives), 269, 207);
  };
}
