import { escapeHtml } from '../../shared/text.js';
export const assets = '/game/tools/';
export const escape = escapeHtml;
export const position = ([x, y, width, height], w = 640, h = 480) =>
  `left:${x / w * 100}%;top:${y / h * 100}%;width:${width / w * 100}%;height:${height / h * 100}%`;
export const hotspot = (id, label, rect, extra = '') =>
  `<button class="tool-hotspot" data-tool="${id}" aria-label="${escape(label)}" title="${escape(label)}" style="${position(rect)}" ${extra}></button>`;
let catalogPromise;
export function loadTools() {
  return catalogPromise ||= fetch(assets + 'catalog.json').then(r => {
    if (!r.ok) throw new Error('Les ressources des outils sont indisponibles.');
    return r.json();
  }).catch(e => { catalogPromise = null; throw e; });
}
export function shell(main, title, body, controls = '') {
  document.title = `${title} · ADI 4`;
  main.innerHTML = `<section class="original-scene tools-scene"><div class="scene-heading"><h1>${title}</h1><a class="button secondary" href="#tools">← Les outils</a></div>${body}<div class="tool-controls">${controls}<button class="button secondary" data-help>Écouter Adi</button><label><input type="checkbox" data-sound checked> Son</label></div><p class="tool-status" role="status"></p><audio preload="auto"></audio></section>`;
  const root = main.firstElementChild, audio = root.querySelector('audio');
  let alive = true;
  const controller = new AbortController();
  main.addEventListener('sceneleave', () => {
    alive = false; audio.pause(); controller.abort(); root.querySelectorAll('dialog[open]').forEach(d => d.close());
  }, { once: true });
  const status = message => { root.querySelector('[role="status"]').textContent = message; };
  root.querySelector('[data-sound]').onchange = e => { audio.muted = !e.target.checked; };
  async function speak(name) {
    try {
      const catalog = await loadTools();
      if (!alive || !catalog.voices[name]) return;
      audio.pause(); audio.src = assets + catalog.voices[name];
      await audio.play();
    } catch { if (alive) status('Clique sur « Écouter Adi » pour lancer la voix.'); }
  }
  return { root, audio, status, speak, signal: controller.signal, get alive() { return alive; } };
}
export function download(blob, filename) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function dialog(root, title, html) {
  const d = document.createElement('dialog'); d.className = 'tool-dialog';
  d.innerHTML = `<form method="dialog"><h2>${escape(title)}</h2><button class="tool-dialog-close" aria-label="Fermer">×</button></form>${html}`;
  d.setAttribute('aria-label', title); root.append(d);
  d.addEventListener('close', () => d.remove(), { once: true }); d.showModal(); return d;
}
export function printContent(root, content) {
  const sheet = document.createElement('div'); sheet.className = 'tool-print-sheet'; sheet.append(content);
  root.append(sheet); document.body.classList.add('printing-tool');
  const cleanup = () => { sheet.remove(); document.body.classList.remove('printing-tool'); };
  window.addEventListener('afterprint', cleanup, { once: true });
  try { window.print(); } finally { cleanup(); }
}
