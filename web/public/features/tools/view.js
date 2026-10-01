import { shell, hotspot } from './shared.js';
import { loadRoomCloseupCatalog } from '../room/closeups.js';
import { createCloseupPlayer } from '../room/closeup-player.js';
const entries = [
  ['calculator', 'La calculatrice', [118, 355, 131, 58], 'STCAL'],
  ['notepad', 'Le bloc-notes', [278, 283, 139, 60], 'STBLO'],
  ['paint', 'La palette Adi', [310, 320, 150, 75], 'STDES'],
];
export async function renderTools(main) {
  const ui = shell(main, 'Les outils', `<div class="scene-frame tools-desk"><img src="/game/room/image-5.webp" alt="Le bureau d’Adi : calculatrice, bloc-notes et palette" width="640" height="480">${entries.map(([id, label, rect]) => hotspot(id, label, rect)).join('')}</div>`, `${entries.map(([id, label]) => `<button class="button secondary" data-open="${id}">${label}</button>`).join('')}<button class="button primary" data-continue hidden>Ouvrir maintenant</button>`);
  ui.root.querySelector('.scene-heading a').href = '#room';
  ui.root.querySelector('.scene-heading a').textContent = '← La chambre';
  let player, catalog, token = 0, idle, pending = null;
  const next = ui.root.querySelector('[data-continue]');
  const pose = () => player?.still(catalog.poses.D, [273, -25]);
  const schedule = () => {
    clearTimeout(idle);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    idle = setTimeout(async () => {
      const current = token;
      if (document.hidden || !player || !ui.alive) { if (ui.alive) schedule(); return; }
      const clips = catalog.idle.D;
      await player.play(clips[Math.floor(Math.random() * clips.length)], { offset: [273, -25] });
      if (!ui.alive || current !== token) return; pose(); schedule();
    }, 3000 + Math.random() * 3000);
  };
  const speak = async name => {
    clearTimeout(idle); const current = ++token;
    if (player) await player.play(name, { offset: [273, -25] });
    if (!ui.alive || token !== current) return false;
    pose(); schedule(); return true;
  };
  const open = async id => {
    const entry = entries.find(e => e[0] === id); if (!entry) return;
    pending = id; next.hidden = false;
    ui.status(entry[1]);
    if (await speak(entry[3] + 'ABCDE'[Math.floor(Math.random() * 5)] + 'D')) location.hash = 'tool/' + id;
  };
  ui.root.querySelectorAll('[data-tool],[data-open]').forEach(b => b.onclick = () => open(b.dataset.tool || b.dataset.open));
  next.onclick = () => { if (pending) location.hash = 'tool/' + pending; };
  ui.root.querySelector('[data-help]').onclick = () => { pending = null; next.hidden = true; speak('AIOUT' + 'ABCDEF'[Math.floor(Math.random() * 6)] + 'D'); };
  ui.root.querySelector('[data-sound]').onchange = e => player?.mute(!e.target.checked);
  main.addEventListener('sceneleave', () => { token++; clearTimeout(idle); player?.dispose(); }, { once: true });
  try {
    catalog = await loadRoomCloseupCatalog(); if (!ui.alive) return;
    player = createCloseupPlayer(ui.root.querySelector('.scene-frame'), catalog, () => ui.status('Clique sur « Écouter Adi » pour lancer sa présentation.'));
    player.mute(!ui.root.querySelector('[data-sound]').checked);
    pose(); ui.status('Choisis un outil sur le bureau.');
    if (!pending) speak('AIOUTAD');
  } catch { if (ui.alive) ui.status('Les voix du bureau sont indisponibles. Les outils restent accessibles.'); }
}
