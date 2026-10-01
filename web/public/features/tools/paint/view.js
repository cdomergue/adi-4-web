import { assets, shell, hotspot, position, loadTools, dialog, download, escape, printContent } from '../shared.js';
import { WIDTH, HEIGHT, createPaper, draw, selectionRect, copySelection, pasteSelection } from './engine.js';
import { paintStore } from './storage.js';
const tools = [
  ['pencil', 'Crayon', [593, 7, 35, 45], 'LVAOUCR'], ['brush', 'Pinceau', [589, 51, 42, 45], 'LVAOUPI'],
  ['circle', 'Cercle', [147, 378, 44, 46], 'LVAOUCE'], ['filledCircle', 'Disque', [202, 376, 41, 52], 'LVAOURO'],
  ['rectangle', 'Rectangle', [247, 376, 40, 50], 'LVAOUCA'], ['filledRectangle', 'Rectangle plein', [292, 375, 37, 51], 'LVAOUCP'],
  ['line', 'Ligne droite', [345, 383, 46, 46], 'LVAOULD'], ['undo', 'Annuler / rétablir', [585, 179, 39, 49], 'LVAOUUD'],
  ['eraser', 'Gomme', [584, 97, 41, 39], 'LVAOUGO'], ['delete', 'Découper', [578, 134, 56, 47], 'LVAOUSU'],
  ['size', 'Trait fin / gros', [450, 378, 79, 51], 'LVAOUTE'], ['symmetry', 'Symétrie', [401, 375, 42, 56], 'LVAOUSY'],
  ['cut', 'Couper et coller', [582, 228, 50, 43], 'LVAOUCC'], ['copy', 'Copier et coller', [588, 275, 39, 51], 'LVAOUCV'],
  ['text', 'Écrire', [586, 334, 41, 60], 'LVAOUAC'],
];
const groups = [[14, 5], [34, 39], [4, 68], [39, 101], [0, 122], [34, 153], [0, 175], [21, 207]];
const shades = [[19, 259, 33, 24], [21, 287, 29, 29], [24, 316, 30, 31], [50, 263, 30, 28], [52, 293, 31, 31], [50, 330, 39, 32]];
const menus = [['background', 'Les fonds'], ['sticker', 'Les vignettes'], ['clear', 'Effacer le dessin'], ['save', 'Sauvegarder'], ['load', 'Charger'], ['print', 'Imprimer'], ['help', 'Aide'], ['exit', 'Quitter']];
let workingCopy = null;
export async function renderPaint(main) {
  const ui = shell(main, 'La palette Adi', `<div class="scene-frame paint-frame"><img src="${assets}palette-0.webp" alt="La palette originale" width="640" height="480"><img class="tool-layer" src="${assets}palette-1.webp" style="${position([580, 6, 55, 390])}" alt=""><img class="tool-layer" src="${assets}palette-3.webp" style="${position([125, 370, 420, 80])}" alt=""><img class="tool-layer" src="${assets}palette-8.webp" style="${position([0, 420, 640, 60])}" alt=""><canvas class="paint-canvas" width="475" height="340" aria-label="Feuille de dessin" tabindex="0" style="${position([102, 30, WIDTH, HEIGHT])}"></canvas><canvas class="paint-overlay" width="475" height="340" style="${position([102, 30, WIDTH, HEIGHT])}"></canvas><div class="paint-colors"></div>${tools.map(([id, label, rect]) => hotspot(id, label, rect, ['size', 'symmetry'].includes(id) ? 'aria-pressed="false"' : '')).join('')}${menus.map(([id, label], i) => hotspot(id, label, [i * 80, 434, 80, 46])).join('')}</div>`, '<button class="button secondary" data-export>Exporter en PNG</button><label class="button secondary">Importer une image<input type="file" data-import accept="image/png,image/jpeg,image/webp" hidden></label>');
  const frame = ui.root.querySelector('.paint-frame'), canvas = frame.querySelector('.paint-canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
  const overlay = frame.querySelector('.paint-overlay'), preview = overlay.getContext('2d');
  let pixels = workingCopy?.slice() || createPaper(), undo = null, tool = 'pencil', thick = false, symmetric = false;
  const selectedShades = [0, 0, 4, 3, 3, 4, 3, 0];
  let group = 1, shade = 0, color = '#808080', start, last, before, selection = null, stamp = null;
  let help = false, generation = 0, dirty = false;
  const flush = () => ctx.putImageData(new ImageData(pixels, WIDTH, HEIGHT), 0, 0);
  flush();
  const changed = () => { dirty = true; generation++; workingCopy = pixels.slice(); };
  const checkpoint = () => { undo = pixels.slice(); };
  const unselect = () => { selection = null; stamp = null; preview.clearRect(0, 0, WIDTH, HEIGHT); };
  const selectTool = id => {
    unselect(); tool = id;
    tools.forEach(([name]) => {
      if (!['size', 'symmetry', 'undo'].includes(name)) frame.querySelector(`[data-tool="${name}"]`).setAttribute('aria-pressed', String(name === tool));
    });
    ui.status(tools.find(t => t[0] === id)?.[1] || 'Clique sur la feuille pour placer la vignette.');
  };
  const clearPreview = () => preview.clearRect(0, 0, WIDTH, HEIGHT);
  const saveDraft = async () => {
    workingCopy = pixels.slice();
    if (!dirty) return;
    const blob = await new Promise(resolve => canvas.toBlob(resolve));
    try { await paintStore('put', { id: 'draft', blob }); }
    catch { if (ui.alive) ui.status('La sauvegarde locale est indisponible. Exporte ton dessin en PNG.'); }
  };
  main.addEventListener('sceneleave', () => { generation++; saveDraft(); }, { once: true });
  window.addEventListener('pagehide', saveDraft, { signal: ui.signal });
  const loadImage = source => new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('Image illisible')); image.src = source;
  });
  const replaceImage = async (source, token = generation) => {
    const image = await loadImage(source);
    if (!ui.alive || token !== generation) return false;
    checkpoint(); unselect(); ctx.fillStyle = '#fcfcfc'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(image, 0, 0, WIDTH, HEIGHT);
    pixels = ctx.getImageData(0, 0, WIDTH, HEIGHT).data; changed(); return true;
  };
  const coordinates = e => {
    const rect = canvas.getBoundingClientRect();
    return [Math.round(Math.max(0, Math.min(WIDTH - 1, (e.clientX - rect.left) * WIDTH / rect.width))), Math.round(Math.max(0, Math.min(HEIGHT - 1, (e.clientY - rect.top) * HEIGHT / rect.height)))];
  };
  function mark(a, b) {
    draw(pixels, { tool, from: a, to: b, color: tool === 'eraser' ? '#fcfcfc' : color,
      size: tool === 'eraser' ? (thick ? 19 : 9) : tool === 'brush' ? (thick ? 19 : 9) : thick ? 9 : 1, symmetric });
    flush();
  }
  canvas.onpointerdown = e => {
    if (e.button !== 0 || start) return; e.preventDefault();
    if (help) { ui.speak(tools.find(t => t[0] === tool)?.[3]); return; }
    const point = coordinates(e); generation++; clearPreview();
    if (tool === 'stamp' && stamp) {
      checkpoint(); pasteSelection(pixels, stamp, point[0] - Math.floor(stamp.width / 2), point[1] - Math.floor(stamp.height / 2)); flush(); changed(); saveDraft(); return;
    }
    if (selection && ['cut', 'copy'].includes(tool)) {
      checkpoint(); pasteSelection(pixels, selection, point[0], point[1]); flush(); changed(); saveDraft(); return;
    }
    if (tool === 'text') { textDialog(point); return; }
    checkpoint(); before = pixels.slice(); start = point; last = point;
    canvas.setPointerCapture(e.pointerId);
    if (['pencil', 'brush', 'eraser'].includes(tool)) mark(start, start);
  };
  canvas.onpointermove = e => {
    const point = coordinates(e);
    if (!start) {
      const clip = tool === 'stamp' ? stamp : selection;
      if (clip) {
        clearPreview(); const image = new ImageData(clip.data, clip.width, clip.height);
        preview.putImageData(image, point[0] - (tool === 'stamp' ? Math.floor(clip.width / 2) : 0), point[1] - (tool === 'stamp' ? Math.floor(clip.height / 2) : 0));
      }
      return;
    }
    if (['cut', 'copy', 'delete'].includes(tool)) {
      clearPreview(); const [x, y, w, h] = selectionRect(start, point);
      preview.setLineDash([3, 3]); preview.strokeStyle = '#000'; preview.strokeRect(x + .5, y + .5, w - 1, h - 1);
    } else if (['pencil', 'brush', 'eraser'].includes(tool)) mark(last, point);
    else { pixels = before.slice(); mark(start, point); }
    last = point;
  };
  canvas.onpointerup = e => {
    if (!start) return;
    const point = coordinates(e);
    if (['cut', 'copy', 'delete'].includes(tool)) {
      const rect = selectionRect(start, point); selection = tool === 'delete' ? null : copySelection(pixels, rect);
      if (tool !== 'copy') {
        const [x, y, w, h] = rect;
        draw(pixels, { tool: 'filledRectangle', from: [x, y], to: [x + w - 1, y + h - 1], color: '#fcfcfc' }); flush(); changed();
      }
      ui.status(tool === 'delete' ? 'La zone est effacée.' : 'Clique sur la feuille pour coller. Échap termine le collage.');
    } else {
      if (['pencil', 'brush', 'eraser'].includes(tool)) mark(last, point);
      else { pixels = before.slice(); mark(start, point); }
      changed();
    }
    start = null; clearPreview(); saveDraft();
  };
  canvas.onpointercancel = () => { if (start) { pixels = before; flush(); start = null; clearPreview(); } };
  canvas.onpointerleave = () => { if (!start) clearPreview(); };
  function textDialog([x, y]) {
    const d = dialog(ui.root, 'Écrire sur le dessin', '<form class="paint-text-form"><label>Texte<input name="text" maxlength="160" required autofocus></label><label>Police<select name="font"><option value="serif">Roman</option><option value="sans-serif">Bâton</option><option value="monospace">Machine à écrire</option><option value="cursive">Manuscrite</option></select></label><label>Taille<select name="size"><option>12</option><option selected>18</option><option>24</option><option>36</option><option>48</option></select></label><button class="button primary">Écrire</button></form>');
    d.querySelector('.paint-text-form').onsubmit = e => {
      e.preventDefault(); const data = new FormData(e.target); checkpoint();
      ctx.font = `${data.get('size')}px ${data.get('font')}`; ctx.fillStyle = color; ctx.textBaseline = 'top';
      ctx.fillText(data.get('text'), x, y); pixels = ctx.getImageData(0, 0, WIDTH, HEIGHT).data;
      changed(); saveDraft(); d.close();
    };
  }
  function undoAction() {
    if (!undo) return;
    [pixels, undo] = [undo, pixels]; unselect(); start = null; flush(); changed(); saveDraft();
  }
  frame.querySelectorAll('[data-tool]').forEach(b => b.onclick = async () => {
    const id = b.dataset.tool;
    if (id === 'help') { help = !help; b.setAttribute('aria-pressed', String(help)); ui.status(help ? 'Clique sur un outil pour écouter son explication. Clique à nouveau sur Aide pour dessiner.' : 'À toi de dessiner !'); return; }
    if (help) { ui.speak(tools.find(t => t[0] === id)?.[3] || ({ background: 'LVACIFDS', sticker: 'LVATMP1', clear: 'LVACIREC', save: 'LVACIVIG', load: 'ICOCHAR1', print: 'LVAIMP', exit: 'ICOQUITT' })[id]); return; }
    if (id === 'undo') undoAction();
    else if (id === 'size') { thick = !thick; b.setAttribute('aria-pressed', String(thick)); ui.status(thick ? 'Trait gros' : 'Trait fin'); }
    else if (id === 'symmetry') { symmetric = !symmetric; b.setAttribute('aria-pressed', String(symmetric)); ui.status(symmetric ? 'Symétrie sur les deux axes' : 'Sans symétrie'); }
    else if (id === 'background' || id === 'sticker') gallery(id);
    else if (id === 'save' || id === 'load') savedPictures(id);
    else if (id === 'clear') {
      const d = dialog(ui.root, 'Veux-tu effacer ton dessin ?', '<button class="button primary" data-yes>Oui</button> <button class="button secondary" data-no>Non</button>');
      d.querySelector('[data-yes]').onclick = () => { checkpoint(); pixels = createPaper(); unselect(); flush(); changed(); saveDraft(); d.close(); };
      d.querySelector('[data-no]').onclick = () => d.close();
    } else if (id === 'print') { const image = new Image(); image.src = canvas.toDataURL(); await image.decode(); if (ui.alive) printContent(ui.root, image); }
    else if (id === 'exit') { await saveDraft(); if (ui.alive) location.hash = 'tools'; }
    else selectTool(id);
  });
  window.addEventListener('keydown', e => {
    if (e.target.matches('input,textarea,select') || ui.root.querySelector('dialog[open]')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undoAction(); }
    if (e.key === 'Escape') { unselect(); selectTool('pencil'); }
  }, { signal: ui.signal });
  ui.root.querySelector('[data-export]').onclick = () => canvas.toBlob(blob => { if (blob) download(blob, 'mon-dessin.png'); });
  ui.root.querySelector('[data-import]').onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 20 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { ui.status('Choisis une image PNG, JPEG ou WebP de moins de 20 Mo.'); return; }
    const url = URL.createObjectURL(file);
    try { await replaceImage(url); saveDraft(); } catch { ui.status('Cette image ne peut pas être ouverte.'); }
    finally { URL.revokeObjectURL(url); e.target.value = ''; }
  };
  ui.root.querySelector('[data-help]').onclick = () => { help = true; ui.status('Clique sur un outil pour écouter Adi, puis désactive Aide pour dessiner.'); frame.querySelector('[data-tool="help"]').setAttribute('aria-pressed', 'true'); ui.speak('LVAOUCR'); };
  let catalog;
  function colors() {
    frame.querySelector('.paint-colors').innerHTML = groups.map(([x, y], i) => `<button class="paint-color-group" data-group="${i}" aria-label="${['Blancs', 'Noirs', 'Bleus', 'Verts', 'Rouges', 'Oranges', 'Bruns', 'Violets'][i]}" aria-pressed="${i === group}" style="${position([x, y, 60, 30])}"><img src="${assets}tube-${i}-${selectedShades[i]}.webp" style="width:100%;height:193.3333%;max-width:none;position:absolute;left:0;top:0" alt=""></button>`).join('') + `<img class="tool-layer" src="${assets}palette-${11 + group}.webp" style="${position([0, 230, 100, 155])}" alt="">` + shades.map((rect, i) => hotspot('shade-' + i, 'Nuance ' + (i + 1), rect, `aria-pressed="${i === shade}"`)).join('');
    frame.querySelectorAll('[data-group]').forEach(b => b.onclick = () => { group = +b.dataset.group; shade = selectedShades[group]; color = catalog.colors[group][shade]; colors(); });
    shades.forEach((_, i) => frame.querySelector(`[data-tool="shade-${i}"]`).onclick = () => { shade = i; selectedShades[group] = i; color = catalog.colors[group][shade]; colors(); });
  }
  function gallery(kind) {
    if (!catalog) return;
    const isSticker = kind === 'sticker', list = isSticker ? catalog.stickers : catalog.backgrounds;
    const groups = isSticker ? Array.from({ length: 30 }, (_, i) => i + 3) : ['Paysages', 'Coloriages', 'Papiers'];
    const d = dialog(ui.root, isSticker ? 'Les vignettes' : 'Les fonds', `<label>${isSticker ? 'Planche' : 'Collection'} <select data-gallery-group>${groups.map((v, i) => `<option value="${v}">${isSticker ? i + 1 : v}</option>`).join('')}</select></label><div class="tool-gallery"></div>`);
    const show = () => {
      const selected = d.querySelector('select').value;
      const items = list.filter(item => String(isSticker ? item.sheet : item.category) === selected);
      d.querySelector('.tool-gallery').innerHTML = items.map((item, i) => `<button data-item="${i}" aria-label="${isSticker ? 'Vignette' : selected} ${i + 1}"><img src="${assets + item.file}" alt="" loading="lazy"></button>`).join('');
      d.querySelectorAll('[data-item]').forEach(b => b.onclick = async () => {
        const item = items[+b.dataset.item], token = generation;
        try {
          if (isSticker) {
            const image = await loadImage(assets + item.file);
            if (!ui.alive || token !== generation || !d.isConnected) return;
            const offscreen = document.createElement('canvas'); offscreen.width = image.width; offscreen.height = image.height;
            const context = offscreen.getContext('2d'); context.drawImage(image, 0, 0);
            selectTool('stamp'); stamp = { width: image.width, height: image.height, data: context.getImageData(0, 0, image.width, image.height).data };
          } else { await replaceImage(assets + item.file, token); saveDraft(); }
          d.close();
        } catch { ui.status('Ce média n’a pas pu être chargé.'); }
      });
    };
    d.querySelector('select').onchange = show; show();
  }
  async function savedPictures(mode) {
    try {
      const entries = await paintStore('getAll'); if (!ui.alive) return;
      const urls = [];
      const d = dialog(ui.root, mode === 'save' ? 'Sauvegarder mon dessin' : 'Charger un dessin', '<p>36 emplacements dans ce navigateur.</p><label>Page <select><option value="0">1</option><option value="1">2</option><option value="2">3</option></select></label><div class="tool-gallery paint-saves"></div>');
      d.addEventListener('close', () => urls.forEach(url => URL.revokeObjectURL(url)), { once: true });
      const show = () => {
        const start = Number(d.querySelector('select').value) * 12;
        d.querySelector('.tool-gallery').innerHTML = Array.from({ length: 12 }, (_, i) => {
          const id = start + i, entry = entries.find(e => e.id === id); let image = '';
          if (entry) { const url = URL.createObjectURL(entry.blob); urls.push(url); image = `<img src="${url}" alt="">`; }
          return `<button data-slot="${id}" ${mode === 'load' && !entry ? 'disabled' : ''}>${image}<span>Dessin ${id + 1}${entry ? '' : ' · vide'}</span></button>`;
        }).join('');
        d.querySelectorAll('[data-slot]').forEach(b => b.onclick = async () => {
          const id = +b.dataset.slot, entry = entries.find(e => e.id === id);
          if (mode === 'save') {
            if (entry && !b.dataset.confirmed) { b.dataset.confirmed = 'true'; b.querySelector('span').textContent = 'Remplacer ? Clique pour confirmer.'; return; }
            b.disabled = true;
            try {
              const blob = await new Promise(resolve => canvas.toBlob(resolve));
              await paintStore('put', { id, blob }); ui.status(`Dessin ${id + 1} sauvegardé.`); d.close();
            } catch { b.disabled = false; ui.status('La sauvegarde a échoué. Exporte le dessin en PNG.'); }
          } else {
            const url = URL.createObjectURL(entry.blob);
            try { await replaceImage(url); saveDraft(); d.close(); } finally { URL.revokeObjectURL(url); }
          }
        });
      };
      d.querySelector('select').onchange = show; show();
    } catch { ui.status('Le stockage local est indisponible. Utilise l’export et l’import PNG.'); }
  }
  try {
    catalog = await loadTools(); if (!ui.alive) return; color = catalog.colors[group][shade]; colors(); selectTool('pencil');
    if (!workingCopy && !dirty) {
      const token = generation;
      const draft = await paintStore('get', 'draft');
      if (draft && ui.alive && generation === token) {
        const url = URL.createObjectURL(draft.blob);
        try { await replaceImage(url, token); undo = null; dirty = false; } finally { URL.revokeObjectURL(url); }
      }
    }
  } catch { if (ui.alive) ui.status(catalog ? 'Le stockage local est indisponible. Pense à exporter ton dessin.' : 'Les couleurs et les vignettes n’ont pas pu être chargées.'); }
}
